"use strict";

const db = require("../../steam_news/db");
const { stmts } = db;

exports.description = "Execute a statement";
exports.run = inter => {
	try {
		const {changes} = db.run(inter.options.getString("params"));
		inter.reply({ephemeral: true, content: `${changes} rows affected`}).catch(console.error);
	} catch(e) {
		inter.reply({ephemeral: true, content: `Error: ${e}`}).catch(error);
	}
};
