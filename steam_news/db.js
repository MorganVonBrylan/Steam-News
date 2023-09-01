"use strict";

const { STEAM_APPID } = require("./api");

const db = module.exports = exports = new require("better-sqlite3")(__dirname+"/watchers.db");
db.pragma("journal_mode = WAL");

const DB_VERSION = 5;

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
	PRIMARY KEY (appId, guildId),
	CONSTRAINT fk_appid FOREIGN KEY (appid) REFERENCES Apps(appid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PriceWatchers (
	appid INTEGER,
	guildId TEXT,
	channelId TEXT NOT NULL,
	roleId TEXT DEFAULT NULL,
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
	cc TEXT NOT NULL
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
	}

	db.run("UPDATE DB_Version SET version = ?", DB_VERSION);
}

const setSteamWatch = db.prepare("INSERT INTO SteamWatchers (guildId, channelId, roleId) VALUES ($guildId, $channelId, $roleId)");
const updateSteamWatch = db.prepare("UPDATE SteamWatchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId");

const getAllCC = db.prepare("SELECT id, cc FROM Guilds");
const setCC = db.prepare("INSERT INTO Guilds (id, cc) VALUES ($id, $cc)");
const updateCC = db.prepare("UPDATE Guilds SET cc = $cc WHERE id = $id");

const stmts = exports.stmts = {
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

	watch: db.prepare("INSERT INTO Watchers (appid, guildId, channelId, roleId) VALUES ($appid, $guildId, $channelId, $roleId)"),
	unwatch: db.prepare("DELETE FROM Watchers WHERE appid = ? AND guildid = ?"),
	updateWatcher: db.prepare("UPDATE Watchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId AND appid = $appid"),
	findWatchedApps: db.prepare("SELECT DISTINCT appid FROM Watchers").pluck(),
	getWatchers: db.prepare("SELECT channelId, roleId FROM Watchers WHERE appid = ?"),
	getWatchedApps: db.prepare(`SELECT a.appid, name, nsfw, channelId, roleId
		FROM Apps a JOIN Watchers w ON (a.appid = w.appid)
		WHERE guildId = ?
		ORDER BY name`),
	updateLatest: db.prepare("UPDATE Apps SET latest = $latest WHERE appid = $appid"),

	watchSteam: { run: (params) =>
		updateSteamWatch.run(params).changes
		|| setSteamWatch.run(params).changes },
	isWatchingSteam: db.prepare("SELECT channelId FROM SteamWatchers WHERE guildId = ?").pluck(),
	unwatchSteam: db.prepare("DELETE FROM SteamWatchers WHERE guildId = ?"),
	getSteamWatchers: db.prepare("SELECT channelId, roleId FROM SteamWatchers"),

	watchPrice: db.prepare("INSERT INTO PriceWatchers (appid, guildId, channelId, roleId) VALUES ($appid, $guildId, $channelId, $roleId)"),
	unwatchPrice: db.prepare("DELETE FROM PriceWatchers WHERE appid = ? AND guildid = ?"),
	updatePriceWatcher: db.prepare("UPDATE PriceWatchers SET channelId = $channelId, roleId = $roleId WHERE guildId = $guildId AND appid = $appid"),
	findWatchedPrices: db.prepare("SELECT appid, name, nsfw, lastPrice FROM Apps a WHERE EXISTS (SELECT '*' FROM PriceWatchers WHERE appid = a.appid)"),
	getPriceWatchers: db.prepare(`SELECT guildId, channelId, roleId, COALESCE(cc, 'US') "cc"
		FROM PriceWatchers LEFT JOIN Guilds ON id = guildId WHERE appid = ?`),
	getWatchedPrices: db.prepare(`SELECT a.appid, name, lastPrice, nsfw, channelId, roleId
		FROM Apps a JOIN PriceWatchers w ON (a.appid = w.appid)
		WHERE guildId = ?
		ORDER BY name`),
	updateLastPrice: db.prepare("UPDATE Apps SET lastPrice = $lastPrice WHERE appid = $appid"),

	getCC: db.prepare("SELECT cc FROM Guilds WHERE id = ?").pluck(),
	setCC: {run: (id, cc) => updateCC.run({id, cc}).changes || setCC.run({id, cc}).changes},
	getAllCC: {readonly: true, all: (indexById = true) => {
		if(!indexById) return getAllCC.all();
		const ccs = {};
		for(const {id, cc} of getAllCC.all())
			ccs[id] = cc;
		return ccs;
	}},

	getLastVote: db.prepare("SELECT lastVote FROM Voters WHERE id = ?").pluck(),
	insertLastVote: db.prepare("INSERT INTO Voters (id, lastVote) VALUES ($id, $date)"),
	updateLastVote: db.prepare("UPDATE Voters SET lastVote = $date WHERE id = $id"),
	getRecentVoters: db.prepare("SELECT * FROM Voters WHERE lastVote > ?"),

	purgeGuild: {
		w: db.prepare("DELETE FROM Watchers WHERE guildId = ?"),
		p: db.prepare("DELETE FROM PriceWatchers WHERE guildId = ?"),
		s: db.prepare("DELETE FROM SteamWatchers WHERE guildId = ?"),
		run: function(id) {
			return {changes: this.w.run(id).changes + this.p.run(id).changes + this.s.run(id).changes};
		},
	},
	purgeChannel: {
		w: db.prepare("DELETE FROM Watchers WHERE channelId = ?"),
		p: db.prepare("DELETE FROM PriceWatchers WHERE channelId = ?"),
		s: db.prepare("DELETE FROM SteamWatchers WHERE channelId = ?"),
		run: function(id) {
			return {changes: this.w.run(id).changes + this.p.run(id).changes + this.s.run(id).changes};
		},
	},
};

const getAll = [
	"getWatchers", "getWatchedApps", "findWatchedApps",
	"getPriceWatchers", "getWatchedPrices", "findWatchedPrices",
	"getSteamWatchers",
	"getAllCC", "getRecentVoters",
];

for(const [name, stmt] of Object.entries(stmts))
	stmts[name] = stmt[stmt.readonly ? (getAll.includes(name) ? "all" : "get") : "run"].bind(stmt);

stmts.updateSteamLatest = latest => stmts.updateLatest(latest, STEAM_APPID);
