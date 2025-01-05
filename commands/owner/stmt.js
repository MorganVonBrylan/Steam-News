
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
		inter.reply({flags: "Ephemeral", content: `${changes} rows affected`}).catch(console.error);
	} catch(e) {
		inter.reply({flags: "Ephemeral", content: `Error: ${e}`});
	}
}
