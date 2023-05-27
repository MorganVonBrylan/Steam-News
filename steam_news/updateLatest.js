"use strict";

// updates Apps.latest to be a timestamp and not a gid

const db = require("./db");
const { query } = require("./api");
const { stmts: {updateLatest} } = db;


const haveLatest = db.prepare("SELECT appid, latest FROM Apps WHERE latest IS NOT NULL").all();

(async () => {
	let n = 0;
	for(const {appid, latest} of haveLatest)
	{
		let lastDate = null;
		for(const news of (await query(appid, 3)).appnews.newsitems)
			if(news.gid === latest)
			{
				lastDate = news.date;
				break;
			}

		updateLatest({appid, latest: lastDate});
		console.log(`Fini ${++n}/${haveLatest.length}`);
	}

	db.exec(`
		CREATE TABLE sqlb_temp_table_1 (
			appid INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			nsfw BOOLEAN DEFAULT NULL,
			latest INTEGER DEFAULT NULL,
			lastPrice INTEGER DEFAULT NULL);
		INSERT INTO sqlb_temp_table_1 SELECT appid, name, nsfw, latest, lastPrice FROM Apps;
		DROP TABLE Apps;
		ALTER TABLE sqlb_temp_table_1 RENAME TO Apps;`);
})();
