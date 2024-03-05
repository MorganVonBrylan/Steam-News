
import db from "../../steam_news/db.js";

export const description = "Execute a SQL statement";
export const options = [{
	type: STRING, name: "sql", required: true,
	description: "The SQL code to run.",
}];
export function run(inter)
{ 
	try {
		const { changes } = db.run(inter.options.getString("sql"));
		inter.reply({ephemeral: true, content: `${changes} rows affected`}).catch(console.error);
	} catch(e) {
		inter.reply({ephemeral: true, content: `Error: ${e}`});
	}
}
