
import { STEAM_APPID } from "./api.js";
import SQLite3 from "better-sqlite3";
import dirname from "../utils/__dirname.js";

import locales from "../localization/locales.js";
const { langCountries } = locales;

const __dirname = dirname(import.meta.url);
const db = new SQLite3(`${__dirname}/watchers.db`);
export default db;
db.pragma("journal_mode = WAL");

const DB_VERSION = 7;

db.run = function(sql, ...params) { return this.prepare(sql).run(...params); }

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

CREATE TABLE IF NOT EXISTS Watchers (
	appid INTEGER,
	guildId TEXT,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL,
	premium BOOLEAN DEFAULT FALSE,
	PRIMARY KEY (appId, guildId),
	CONSTRAINT fk_appid FOREIGN KEY (appid) REFERENCES Apps(appid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PriceWatchers (
	appid INTEGER,
	guildId TEXT,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL,
	premium BOOLEAN DEFAULT FALSE,
	PRIMARY KEY (appId, guildId),
	CONSTRAINT fk_price_appid FOREIGN KEY (appid) REFERENCES Apps(appid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SteamWatchers (
	guildId TEXT PRIMARY KEY,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL
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
	}

	db.run("UPDATE DB_Version SET version = ?", DB_VERSION);
}


/**
 * Makes a proxy, for when just one statement isn't enough.
 * @param {string|string[]} sql SQL statement(s). If this argument is provided, the statement(s) will be prepared, and bound to the run function as thisArg.
 * @param {function} run The function to run. Make sure this is not an arrow function.
 * @returns {object} Something that looks, swims and quacks like a prepared statement.
 */
function makeProxy(sql, run) {
	let readonly;
	if(sql instanceof Array)
	{
		sql = sql.map(db.prepare.bind(db));
		readonly = sql.every(stmt => stmt.readonly);
	}
	else
	{
		sql = db.prepare(sql);
		readonly = sql.readonly;
	}
	return { readonly, [readonly ? "all" : "run"]: run.bind(sql) };
}

const watchTables = ["Watchers", "PriceWatchers", "SteamWatchers"];

export const stmts = {
	getStats: db.prepare(`SELECT
		(SELECT COUNT('*') FROM Watchers) AS "watchers",
		(SELECT COUNT(DISTINCT appid) FROM Watchers) AS "watchedApps",
		(SELECT COUNT('*') FROM PriceWatchers) AS "priceWatchers",
		(SELECT COUNT(DISTINCT appid) FROM PriceWatchers) AS "watchedPrices",
		name as "maxName", MAX((SELECT COUNT(channelId) FROM Watchers w WHERE a.appid = w.appid)) AS "maxWatchers"
		FROM Apps a;
	`),

	insertApp: db.prepare("INSERT INTO Apps (appid, name, nsfw, latest, lastPrice) VALUES (?, ?, ?, ?, ?)"),

	isAppKnown: db.prepare("SELECT 1 FROM Apps WHERE appid = ?"),
	getAppInfo: db.prepare("SELECT * FROM Apps WHERE appid = ?"),
	getAppName: db.prepare("SELECT name FROM Apps WHERE appid = ?").pluck(),
	isAppNSFW: db.prepare("SELECT nsfw FROM Apps WHERE appid = ?").pluck(),
	getPrice: db.prepare("SELECT lastPrice FROM Apps WHERE appid = ?").pluck(),

	watch: db.prepare("INSERT INTO Watchers (appid, guildId, channelId, roleId, premium) VALUES ($appid, $guildId, $channelId, $roleId, $premium)"),
	unwatch: db.prepare("DELETE FROM Watchers WHERE appid = ? AND guildid = ?"),
	updateWatcher: db.prepare("UPDATE Watchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId AND appid = $appid"),
	findWatchedApps: db.prepare("SELECT DISTINCT appid FROM Watchers").pluck(),
	getWatchers: db.prepare("SELECT guildId, channelId, roleId, premium FROM Watchers WHERE appid = ?"),
	getWatchedApps: db.prepare(`SELECT a.appid, name, nsfw, channelId, roleId
		FROM Apps a JOIN Watchers w ON (a.appid = w.appid)
		WHERE guildId = ?
		ORDER BY name`),
	updateLatest: db.prepare("UPDATE Apps SET latest = $latest WHERE appid = $appid"),

	watchSteam: makeProxy([
		"UPDATE SteamWatchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId",
		"INSERT INTO SteamWatchers (guildId, channelId, roleId) VALUES ($guildId, $channelId, $roleId)",
	], function(params) {
		return this[0].run(params).changes || this[1].run(params).changes;
	}),
	getSteamWatcher: db.prepare("SELECT channelId FROM SteamWatchers WHERE guildId = ?").pluck(),
	unwatchSteam: db.prepare("DELETE FROM SteamWatchers WHERE guildId = ?"),
	getSteamWatchers: db.prepare("SELECT channelId, roleId FROM SteamWatchers"),

	watchPrice: db.prepare("INSERT INTO PriceWatchers (appid, guildId, channelId, roleId, premium) VALUES ($appid, $guildId, $channelId, $roleId, $premium)"),
	unwatchPrice: db.prepare("DELETE FROM PriceWatchers WHERE appid = ? AND guildid = ?"),
	updatePriceWatcher: db.prepare("UPDATE PriceWatchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId AND appid = $appid"),
	findWatchedPrices: db.prepare("SELECT appid, name, nsfw, lastPrice FROM Apps a WHERE EXISTS (SELECT '*' FROM PriceWatchers WHERE appid = a.appid)"),
	getPriceWatchers: db.prepare(`SELECT guildId, channelId, roleId, COALESCE(cc, 'US') "cc", premium
		FROM PriceWatchers LEFT JOIN Guilds ON id = guildId WHERE appid = ?`),
	getWatchedPrices: db.prepare(`SELECT a.appid, name, lastPrice, nsfw, channelId, roleId
		FROM Apps a JOIN PriceWatchers w ON (a.appid = w.appid)
		WHERE guildId = ?
		ORDER BY name`),
	updateLastPrice: db.prepare("UPDATE Apps SET lastPrice = $lastPrice WHERE appid = $appid"),

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
};

const getAll = [
	"getWatchers", "getWatchedApps", "findWatchedApps",
	"getPriceWatchers", "getWatchedPrices", "findWatchedPrices",
	"getSteamWatchers",
	"getAllLocales", "getRecentVoters",
];

for(const [name, stmt] of Object.entries(stmts))
	stmts[name] = stmt[stmt.readonly ? (getAll.includes(name) ? "all" : "get") : "run"].bind(stmt);

stmts.updateSteamLatest = latest => stmts.updateLatest(latest, STEAM_APPID);

Object.freeze(stmts);



/* *************************** */
/* ********* BACKUPS ********* */
/* *************************** */

import AdmZip from "adm-zip";
import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename } from "node:path";
import "../utils/prototypes.js";

const { BACKUP_SCHEDULE } = process.env;
console.log("Database backup schedule:", BACKUP_SCHEDULE);

if(BACKUP_SCHEDULE)
{

function padNum(number) {
	return number.toString().padStart(2, 0);
}

const backupsDir = `${__dirname}/_backups`;
if(!existsSync(backupsDir))
	mkdirSync(backupsDir);

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

let backupZip = new AdmZip(existsSync(backupZipName()) ? backupZipName() : null);
const backupDb = db.prepare("VACUUM INTO ?");
scheduleBackup();

function scheduleBackup()
{
	let next = new Date();
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