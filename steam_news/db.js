
import { STEAM_APPID } from "./api.js";
import SQLite3 from "better-sqlite3";

import { dictionary } from "../utils/dictionaries.js";

import locales from "../localization/locales.js";
const { langCountries } = locales;

const db = new SQLite3(`${import.meta.dirname}/watchers.db`);
export default db;
db.pragma("journal_mode = WAL");

const DB_VERSION = 8;

db.run = function(sql, ...params) { return this.prepare(sql).run(...params); }


/**
 * @typedef {{appid:number, name:string, nsfw:?boolean, guildId:string, channelId:string, roleId:?string, premium:boolean, webhook:?string}} Watcher
 * @typedef {Watcher & {latest:number}} NewsWatcher
 * @typedef {Watcher & {lastPrice: number}} PriceWatcher
 * @typedef {Omit<NewsWatcher, "appid"|"nsfw">} SteamWatcher
 * @typedef {SteamWatcher & {clanid:string}} GroupWatcher
 */

/* ***** If there ever is a need to change a column in Apps DO NOT DROP IT ***** */
/* *****            There are foreigns key here! Back them up!             ***** */
/* *****        Alternatively, PRAGMA foreign_keys = '0'; is a thing       ***** */
db.exec(`
CREATE TABLE IF NOT EXISTS Apps (
	appid INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	nsfw BOOLEAN DEFAULT NULL,
	latest INTEGER DEFAULT NULL,
	lastPrice INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS Groups (
	clanid INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	vanityURL TEXT NOT NULL,
	latest INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS Watchers (
	appid INTEGER,
	guildId TEXT,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL,
	premium BOOLEAN DEFAULT FALSE,
	webhook TEXT DEFAULT NULL,
	PRIMARY KEY (appId, guildId),
	CONSTRAINT fk_appid FOREIGN KEY (appid) REFERENCES Apps(appid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PriceWatchers (
	appid INTEGER,
	guildId TEXT,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL,
	premium BOOLEAN DEFAULT FALSE,
	webhook TEXT DEFAULT NULL,
	PRIMARY KEY (appId, guildId),
	CONSTRAINT fk_price_appid FOREIGN KEY (appid) REFERENCES Apps(appid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SteamWatchers (
	guildId TEXT PRIMARY KEY,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL,
	webhook TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS GroupWatchers (
	clanid INTEGER,
	guildId TEXT,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL,
	premium BOOLEAN DEFAULT FALSE,
	webhook TEXT DEFAULT NULL,
	PRIMARY KEY (clanid, guildId),
	CONSTRAINT fk_clanid FOREIGN KEY (clanid) REFERENCES Groups(clanid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Guilds (
	id TEXT PRIMARY KEY,
	cc TEXT NOT NULL,
	lang TEXT NOT NULL DEFAULT 'english'
);

CREATE TABLE IF NOT EXISTS Voters (
	id TEXT PRIMARY KEY,
	lastVote INTEGER NOT NULL
);
`);

try {
	db.exec(`-- No "IF NOT EXISTS", we WANT this to crash if it already exists so the version isn't inserted twice
		CREATE TABLE DB_Version (version INTEGER PRIMARY KEY);
		INSERT INTO DB_Version VALUES (0);`);
} catch {}

const currentVersion = db.prepare("SELECT version FROM DB_VERSION").pluck().get();
if(currentVersion < DB_VERSION)
{
	// Upgrade database
	switch(currentVersion)
	{
	case 0: // first time
		db.exec(`INSERT INTO Apps (appid, name, nsfw) VALUES (${STEAM_APPID}, 'Steam News Hub', FALSE);`);
		break;

	case 1:
		db.exec("ALTER TABLE Apps ADD lastPrice INTEGER DEFAULT NULL;");
		// no break; !
	case 2:
		// No ALTER COLUMN in SQLite :(
		db.exec(`CREATE TABLE sqlb_temp_table_1 (id TEXT PRIMARY KEY, cc TEXT NOT NULL);
		INSERT INTO sqlb_temp_table_1 (id, cc) SELECT id, cc FROM Guilds;
		DROP TABLE Guilds;
		ALTER TABLE sqlb_temp_table_1 RENAME TO Guilds;`);

	case 3:
		try {
			db.exec(`INSERT INTO Apps (appid, name, nsfw) VALUES (${STEAM_APPID}, 'Steam News Hub', FALSE);`);
		} catch {
			db.exec(`
				UPDATE Apps SET name = 'Steam News Hub' WHERE appid = ${STEAM_APPID};
				INSERT INTO SteamWatchers(guildId, channelId) SELECT guildId, channelId FROM Watchers WHERE appid = ${STEAM_APPID};
				DELETE FROM Watchers WHERE appid = ${STEAM_APPID};`);
		}
			
	case 4:
		db.exec(`
			ALTER TABLE Watchers ADD roleId TEXT DEFAULT NULL;
			ALTER TABLE PriceWatchers ADD roleId TEXT DEFAULT NULL;
			ALTER TABLE SteamWatchers ADD roleId TEXT DEFAULT NULL;
			ALTER TABLE SteamWatchers RENAME channelID TO channelId;
		`);

	case 5:
		db.exec("ALTER TABLE Guilds ADD lang TEXT NOT NULL DEFAULT 'english'");
		for(const [lang, countries] of Object.entries(langCountries))
			db.exec(`UPDATE Guilds SET lang = '${lang}' WHERE cc IN ('${countries.join("','")}')`);
	
	case 6:
		db.exec(`ALTER TABLE Watchers ADD premium BOOLEAN DEFAULT FALSE;
			ALTER TABLE PriceWatchers ADD premium BOOLEAN DEFAULT FALSE;`);
	case 7:
		db.exec(["Watchers", "PriceWatchers", "SteamWatchers"]
			.map(table => `ALTER TABLE ${table} ADD webhook TEXT DEFAULT NULL;`).join(""));
	}

	db.run("UPDATE DB_Version SET version = ?", DB_VERSION);
}


/**
 * Makes a proxy, for when just one statement isn't enough.
 * @param {string|string[]} sql SQL statement(s). If this argument is provided, the statement(s) will be prepared, and bound to the run function as thisArg.
 * @param {function} run The function to run. Make sure this is not an arrow function.
 * @param {boolean} pluck Whether to pluck the stmts
 * @returns {object} Something that looks, swims and quacks like a prepared statement.
 */
function makeProxy(sql, run, pluck = false) {
	let readonly;
	if(sql instanceof Array)
	{
		sql = sql.map(db.prepare.bind(db));
		readonly = sql.every(stmt => stmt.readonly);
		if(pluck) for(const stmt of sql)
			stmt.pluck();
	}
	else
	{
		sql = db.prepare(sql);
		readonly = sql.readonly;
		if(pluck)
			sql.pluck();
	}
	return { readonly, [readonly ? "all" : "run"]: run.bind(sql) };
}

const watchTables = ["Watchers", "PriceWatchers", "SteamWatchers", "GroupWatchers"];
/**
 * Returns a callback that sets an object's "type" property to the provided type.
 * Meant for use with .forEach() and .map()
 * @example priceWatchers.forEach(setType("price"));
 * console.log(priceWatchers[0].type); // "price"
 * @param {string} type The type
 * @returns {function} The callback
 */
function setType(type) {
	return watcher => {
		watcher.type = type;
		return watcher;
	};
}

/** @type {{[sqlStatementName:string]: function}} */
export const stmts = dictionary({
	getStats: db.prepare(`SELECT
		(SELECT COUNT('*') FROM Watchers) AS "watchers",
		(SELECT COUNT(DISTINCT appid) FROM Watchers) AS "watchedApps",
		(SELECT COUNT('*') FROM PriceWatchers) AS "priceWatchers",
		(SELECT COUNT(DISTINCT appid) FROM PriceWatchers) AS "watchedPrices",
		(SELECT COUNT('*') FROM SteamWatchers) AS "steamWatchers",
		(SELECT COUNT('*') FROM GroupWatchers) AS "groupWatchers",
		(SELECT COUNT(DISTINCT clanid) FROM GroupWatchers) AS "watchedGroups",
		MaxApp.*, MaxGroup.*
		FROM (SELECT name as "mostWatchedName", MAX((SELECT COUNT(channelId) FROM Watchers w WHERE a.appid = w.appid)) AS "mostWatchedTotal" FROM Apps a) as MaxApp,
			(SELECT name as "mostWatchedGroup", MAX((SELECT COUNT(channelId) FROM GroupWatchers w WHERE g.clanid = w.clanid)) AS "mostWatchedGroupTotal" FROM Groups g) as MaxGroup;
	`),

	insertApp: db.prepare("INSERT INTO Apps (appid, name, nsfw, latest, lastPrice) VALUES (?, ?, ?, ?, ?)"),

	isAppKnown: db.prepare("SELECT 1 FROM Apps WHERE appid = ?").pluck(),
	getAppInfo: db.prepare("SELECT * FROM Apps WHERE appid = ?"),
	getAppName: db.prepare("SELECT name FROM Apps WHERE appid = ?").pluck(),
	isAppNSFW: db.prepare("SELECT nsfw FROM Apps WHERE appid = ?").pluck(),
	getPrice: db.prepare("SELECT lastPrice FROM Apps WHERE appid = ?").pluck(),

	watch: db.prepare("INSERT INTO Watchers (appid, guildId, channelId, roleId, premium) VALUES ($appid, $guildId, $channelId, $roleId, $premium)"),
	unwatch: db.prepare("DELETE FROM Watchers WHERE appid = ? AND guildid = ?"),
	updateWatcher: db.prepare("UPDATE Watchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId AND appid = $appid"),
	findWatchedApps: db.prepare("SELECT DISTINCT appid FROM Watchers").pluck(),
	getWatcher: db.prepare("SELECT * FROM Watchers WHERE appid = $appid AND guildId = $guildId"),
	getWatchers: db.prepare("SELECT * FROM Watchers WHERE appid = ?"),
	getWatchedApps: db.prepare(`SELECT name, nsfw, latest, w.*
		FROM Apps a JOIN Watchers w ON a.appid = w.appid
		WHERE guildId = ?
		ORDER BY name`),
	updateLatest: db.prepare("UPDATE Apps SET latest = $latest WHERE appid = $appid"),
	getWatcherChannel: db.prepare("SELECT channelId from Watchers WHERE appid = $appid AND guildId = $guildId").pluck(),
	isWatched: db.prepare("SELECT EXISTS(SELECT 1 FROM Watchers WHERE appid = ?)").pluck(),

	watchSteam: makeProxy([
		"UPDATE SteamWatchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId",
		"INSERT INTO SteamWatchers (guildId, channelId, roleId) VALUES ($guildId, $channelId, $roleId)",
	], function(params) {
		return this[0].run(params).changes || this[1].run(params).changes;
	}),
	getSteamWatcher: db.prepare("SELECT * FROM SteamWatchers WHERE guildId = ?"),
	isWatchingSteam: db.prepare("SELECT 1 FROM SteamWatchers WHERE guildId = ?").pluck(),
	getSteamChannel: db.prepare("SELECT channelId FROM SteamWatchers WHERE guildId = ?").pluck(),
	unwatchSteam: db.prepare("DELETE FROM SteamWatchers WHERE guildId = ?"),
	getSteamWatchers: db.prepare("SELECT * FROM SteamWatchers"),
	isSteamWatched: db.prepare("SELECT EXISTS(SELECT 1 FROM SteamWatchers)").pluck(),

	watchPrice: db.prepare("INSERT INTO PriceWatchers (appid, guildId, channelId, roleId, premium) VALUES ($appid, $guildId, $channelId, $roleId, $premium)"),
	unwatchPrice: db.prepare("DELETE FROM PriceWatchers WHERE appid = ? AND guildid = ?"),
	updatePriceWatcher: db.prepare("UPDATE PriceWatchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId AND appid = $appid"),
	findWatchedPrices: db.prepare("SELECT appid, name, nsfw, lastPrice FROM Apps a WHERE EXISTS (SELECT '*' FROM PriceWatchers WHERE appid = a.appid)"),
	getPriceWatcher: db.prepare("SELECT * FROM PriceWatchers WHERE appid = $appid AND guildId = $guildId"),
	getPriceWatchers: db.prepare(`SELECT PriceWatchers.*, lang, COALESCE(cc, 'US') "cc"
		FROM PriceWatchers LEFT JOIN Guilds ON id = guildId WHERE appid = ?`),
	getWatchedPrices: db.prepare(`SELECT name, lastPrice, nsfw, w.*
		FROM Apps a JOIN PriceWatchers w ON a.appid = w.appid
		WHERE guildId = ?
		ORDER BY name`),
	updateLastPrice: db.prepare("UPDATE Apps SET lastPrice = $lastPrice WHERE appid = $appid"),
	getPriceWatcherChannel: db.prepare("SELECT channelId from PriceWatchers WHERE appid = $appid AND guildId = $guildId").pluck(),

	insertGroup: db.prepare("INSERT INTO Groups (clanid, name, vanityURL, latest) VALUES (?, ?, ?, ?)"),
	updateGroup: db.prepare("UPDATE Groups SET name = $group_name, vanityURL = $vanity_url WHERE clanid = $clanid"),
	getGroupInfo: db.prepare("SELECT * FROM Groups WHERE clanid = ?"),
	getGroupName: db.prepare("SELECT name FROM Groups WHERE clanid = ?").pluck(),
	getGroupByName: db.prepare("SELECT * FROM Groups WHERE name = ? COLLATE NOCASE"),

	watchGroup: db.prepare("INSERT INTO GroupWatchers (clanid, guildId, channelId, roleId, premium) VALUES ($clanid, $guildId, $channelId, $roleId, $premium)"),
	unwatchGroup: db.prepare("DELETE FROM GroupWatchers WHERE clanid = ? AND guildId = ?"),
	updateGroupWatcher: db.prepare("UPDATE GroupWatchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId AND clanid = $clanid"),
	findWatchedGroups: db.prepare("SELECT clanid, latest FROM Groups g WHERE EXISTS (SELECT '*' FROM GroupWatchers WHERE clanid = g.clanid)"),
	getGroupWatcher: db.prepare("SELECT * FROM GroupWatchers WHERE clanid = $clanid AND guildId = $guildId"),
	getGroupWatchers: db.prepare(`SELECT GroupWatchers.*, lang
		FROM GroupWatchers LEFT JOIN Guilds ON id = guildId WHERE clanid = ?`),
	getWatchedGroups: db.prepare(`SELECT w.*, name, latest
		FROM Groups g JOIN GroupWatchers w ON g.clanid = w.clanid
		WHERE guildId = ?`),
	updateGroupLatest: db.prepare("UPDATE Groups SET latest = $latest WHERE clanid = $clanid"),
	updateLatestPost: db.prepare("UPDATE Groups SET latest = $latest WHERE clanid = $clanid"),
	getGroupWatcherChannel: db.prepare("SELECT channelId from GroupWatchers WHERE clanid = $clanid AND guildId = $guildId").pluck(),
	isGroupWatched: db.prepare("SELECT EXISTS(SELECT 1 FROM GroupWatchers WHERE clanid = ?)").pluck(),

	setWebhook: db.prepare("UPDATE Watchers SET webhook = $webhook WHERE appid = $appid AND channelId = $channelId"),
	setPriceWebhook: db.prepare("UPDATE PriceWatchers SET webhook = $webhook WHERE appid = $appid AND channelId = $channelId"),
	setSteamWebhook: db.prepare("UPDATE SteamWatchers SET webhook = $webhook WHERE channelId = $channelId"),
	setGroupWebhook: db.prepare("UPDATE GroupWatchers SET webhook = $webhook WHERE channelId = $channelId AND clanid = $clanid"),
	getWebhook: db.prepare("SELECT webhook FROM Watchers WHERE guildId = $guildId AND appid = $appid").pluck(),
	getPriceWebhook: db.prepare("SELECT webhook FROM PriceWatchers WHERE guildId = $guildId AND appid = $appid").pluck(),
	getSteamWebhook: db.prepare("SELECT webhook FROM SteamWatchers WHERE guildId = ?").pluck(),
	getGroupWebhook: db.prepare("SELECT webhook FROM GroupWatchers WHERE guildId = $guildId AND clanid = $clanid").pluck(),
	getWebhooks: makeProxy([
		...["Watchers", "PriceWatchers"].map(table => `
			SELECT a.appid, name, channelId, webhook
			FROM ${table} w JOIN Apps a ON w.appid = a.appid
			WHERE guildId = ? AND webhook IS NOT NULL
		`),
		`SELECT ${STEAM_APPID} "appid", 'Steam News Hub' "name", channelId, webhook
		FROM SteamWatchers WHERE guildId = ? AND webhook IS NOT NULL`,
		`SELECT g.clanId, name, channelId, webhook
		FROM GroupWatchers w JOIN Groups g ON w.clanid = g.clanid
		WHERE guildId = ? AND webhook IS NOT NULL`,
	], function(guildId, merge = true) {
		const steam = this[2].get(guildId);
		const res = {
			news: this[0].all(guildId),
			price: this[1].all(guildId),
			steam: steam ? setType("steam")(steam) : null,
			group: this[3].all(guildId),
		};
		return merge ? res.news.map(setType("news")).concat(
			res.price.map(setType("price")),
			res.group.map(setType("group")),
			res.steam || [],
		) : res;
	}),
	getChannelWebhooks: makeProxy(watchTables.map(table => `
		SELECT IIF(INSTR(webhook, '#'), SUBSTR(webhook, 0, INSTR(webhook, '#')), webhook)
		FROM ${table}
		WHERE channelId = ? AND webhook IS NOT NULL
	`), function(channelId) {
		return Array.from(new Set(this.map(stmt => stmt.all(channelId)).flat()));
	}, { pluck: true }),
	purgeWebhook: makeProxy(watchTables.map(table => `UPDATE ${table}
		SET webhook = NULL WHERE webhook LIKE ? || '%';`
	), function(webhookIdAndToken) {
		return !!this.reduce((changes, stmt) => changes + stmt.run(webhookIdAndToken).changes, 0);
	}),
	decoupleWebhooks: makeProxy(watchTables.map(table => `UPDATE ${table}
		SET webhook = NULL WHERE guildId = ? AND webhook IS NOT NULL`
	), function(guildId) {
		return this.reduce((changes, stmt) => changes + stmt.run(guildId).changes, 0);
	}),

	getNonWebhooks: makeProxy([
		...["Watchers", "PriceWatchers"].map(table => `
			SELECT a.appid, name, channelId
			FROM ${table} w JOIN Apps a ON w.appid = a.appid
			WHERE guildId = ? AND webhook IS NULL
		`),
		"SELECT channelId FROM SteamWatchers WHERE guildId = ? AND webhook IS NULL",
		`SELECT g.clanid, name, channelId
		 FROM GroupWatchers w JOIN Groups g ON w.clanid = g.clanid
		 WHERE guildId = ? AND webhook IS NULL`,
	], function(guildId) {
		const steam = this[2].get(guildId);
		return this[0].all(guildId).map(setType("news")).concat(
			this[1].all(guildId).map(setType("price")),
			this[3].all(guildId).map(setType("group")),
			steam ? setType("steam")(steam) : [],
		);
	}),

	getCC: db.prepare("SELECT cc FROM Guilds WHERE id = ?").pluck(),
	getLocale: db.prepare("SELECT cc, lang FROM Guilds WHERE id = ?"),
	setLocale: makeProxy([
		"UPDATE Guilds SET cc = $cc, lang = $lang WHERE id = $id",
		"INSERT INTO Guilds (id, cc, lang) VALUES ($id, $cc, $lang)"
	], function(id, cc, lang) {
		const args = { id, cc, lang };
		return this[0].run(args).changes || this[1].run(args).changes;
	}),
	getAllLocales: makeProxy("SELECT id, cc, lang FROM Guilds",
	function(indexById = true) {
		if(!indexById) return this.all();
		const ccs = {};
		for(const {id, cc} of this.all())
			ccs[id] = cc;
		return ccs;
	}),

	getLastVote: db.prepare("SELECT lastVote FROM Voters WHERE id = ?").pluck(),
	insertLastVote: db.prepare("INSERT INTO Voters (id, lastVote) VALUES ($id, $date)"),
	updateLastVote: db.prepare("UPDATE Voters SET lastVote = $date WHERE id = $id"),
	getRecentVoters: db.prepare("SELECT * FROM Voters WHERE lastVote > ?"),

	purgeGuild: makeProxy(watchTables.map(table => `DELETE FROM ${table} WHERE guildId = ?`),
	function(id) {
		return { changes: this.reduce((changes, stmt) => changes + stmt.run(id), 0) };
	}),
	purgeChannel: makeProxy(watchTables.map(table => `DELETE FROM ${table} WHERE channelId = ?`),
	function(id) {
		return { changes: this.reduce((changes, stmt) => changes + stmt.run(id), 0) };
	}),
});

if(!stmts.isAppKnown.get(STEAM_APPID))
	db.run(`INSERT INTO Apps (appid, name, nsfw)
			VALUES (${STEAM_APPID}, 'Steam News Hub', FALSE)`);

const getAll = Object.keys(stmts).filter(name => name !== "getStats"
	&& (name.startsWith("get") || name.startsWith("find"))
	&& name.endsWith("s"));

// Any errors here about reading undefined are most likely caused by the stmt
// not being in the getAll list above
// Yes this is a very flimsy system but fixing it is not a priority
for(const [name, stmt] of Object.entries(stmts))
	stmts[name] = stmt[stmt.readonly ? (getAll.includes(name) ? "all" : "get") : "run"].bind(stmt);

stmts.updateSteamLatest = latest => stmts.updateLatest(latest, STEAM_APPID);

Object.freeze(stmts);



/* *************************** */
/* ********* BACKUPS ********* */
/* *************************** */

import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename } from "node:path";

const { BACKUP_SCHEDULE } = process.env;
console.log("Database backup schedule:", BACKUP_SCHEDULE);

if(BACKUP_SCHEDULE)
{
	const { default: AdmZip } = await import("adm-zip");

	const backupsDir = `${import.meta.dirname}/_backups`;
	if(!existsSync(backupsDir))
		mkdirSync(backupsDir);

	function padNum(number) {
		return number.toString().padStart(2, 0);
	}
	function backupZipName(date = new Date()) {
		if(date === "nextMonth") {
			date = new Date();
			date.setMonth(date.getMonth() + 1, 1);
		}
		return `${backupsDir}/${date.getFullYear()}-${padNum(date.getMonth()+1)}.zip`;
	}
	function backupFileName(date = new Date()) {
		return backupZipName(date).replace(".zip", `-${padNum(date.getDate())}.db`);
	}

	const currentZip = backupZipName();
	let backupZip = new AdmZip(existsSync(currentZip) ? currentZip : null);
	const backupDb = db.prepare("VACUUM INTO ?");
	scheduleBackup();

	function scheduleBackup()
	{
		const next = new Date();
		const currentMonth = next.getMonth();
		next.setHours(0, 1, 0);
		if(BACKUP_SCHEDULE === "daily")
			next.setDate(next.getDate() + 1);
		else
			next.setDate(next.getDate() + 7 - next.getDay());

		if(next.getMonth() !== currentMonth)
			backupZip = new AdmZip();
		setTimeout(backup, next.getTime() - Date.now());
	}
	async function backup()
	{
		const fileName = backupFileName();
		const zipName = backupZipName();
		backupDb.run(fileName);
		backupZip.addLocalFile(fileName);
		backupZip.writeZip(zipName);
		rm(fileName);

		console.info("Database backed up:", basename(fileName), "into", basename(zipName));
		scheduleBackup();
	}
} // if(BACKUP_SCHEDULE)