"use strict";

const db = module.exports = exports = new require("better-sqlite3")(__dirname+"/watchers.db");

const DB_VERSION = 1;

db.run = function(sql, params) { return this.prepare(sql).run(params); }

db.exec(`
CREATE TABLE IF NOT EXISTS Apps (
	appid INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	nsfw BOOLEAN DEFAULT NULL,
	latest TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS Watchers (
	appid INTEGER,
	guildId TEXT,
	channelId TEXT NOT NULL,
	PRIMARY KEY (appId, guildId),
	CONSTRAINT fk_appid FOREIGN KEY (appid) REFERENCES Apps(appid) ON DELETE CASCADE
);
`);

try {
	db.exec(`-- No "IF NOT EXISTS", we WANT this to crash if it already exists
		CREATE TABLE DB_Version (version INTEGER PRIMARY KEY);
		INSERT INTO DB_Version VALUES (${DB_VERSION});`);
} catch {}

	/*const currentVersion = db.prepare("SELECT version FROM DB_VERSION").pluck().get();
	if(currentVersion < DB_VERSION)
	{
		// Upgrade database

		switch(currentVersion)
		{
		case 1:
			// upgrades for 1 to 2
			// no break; !
		case 2:
			// upgrades for 2 to 3
			// etc
		}

		db.run("UPDATE DB_Version SET version = ?", DB_VERSION);
	}*/

const stmts = exports.stmts = {
	insertApp: db.prepare("INSERT INTO Apps (appid, name, nsfw, latest) VALUES (?, ?, ?, ?)"),

	isAppKnown: db.prepare("SELECT 1 FROM Apps WHERE appid = ?"),
	getAppInfo: db.prepare("SELECT * FROM Apps WHERE appid = ?"),
	getAppName: db.prepare("SELECT name FROM Apps WHERE appid = ?").pluck(),
	isAppNSFW: db.prepare("SELECT nsfw FROM Apps WHERE appid = ?").pluck(),

	watch: db.prepare("INSERT INTO Watchers (appid, guildId, channelId) VALUES (?, ?, ?)"),
	unwatch: db.prepare("DELETE FROM Watchers WHERE appid = ? AND guildid = ?"),
	findWatchedApps: db.prepare("SELECT DISTINCT appid FROM Watchers").pluck(),
	getWatchers: db.prepare("SELECT channelId FROM Watchers WHERE appid = ?").pluck(),
	getWatchedApps: db.prepare(`SELECT a.appid, name, nsfw, channelId
		FROM Apps a JOIN Watchers w ON (a.appid = w.appid)
		WHERE guildId = ?`),
	updateLatest: db.prepare("UPDATE Apps SET latest = $latest WHERE appid = $appid"),

	purgeGuild: db.prepare("DELETE FROM Watchers WHERE guildId = ?"),
	purgeChannel: db.prepare("DELETE FROM Watchers WHERE channelId = ?"),
};

const getAll = ["getWatchers", "getWatchedApps", "findWatchedApps"];

for(const [name, stmt] of Object.entries(stmts))
	stmts[name] = stmt[stmt.readonly ? (getAll.includes(name) ? "all" : "get") : "run"].bind(stmt);
