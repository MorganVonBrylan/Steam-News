"use strict";

const db = require("../../steam_news/db");

exports.description = "Execute a SQL statement";
exports.options = [{
	type: STRING, name: "sql", required: true,
	description: "The SQL code to run.",
}];
exports.run = inter => {
	try {
		const {changes} = db.run(inter.options.getString("sql"));
		inter.reply({ephemeral: true, content: `${changes} rows affected`}).catch(console.error);
	} catch(e) {
		inter.reply({ephemeral: true, content: `Error: ${e}`});
	}
};
