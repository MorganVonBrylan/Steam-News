
import { readdirSync } from "node:fs";
import __dirname from "../../utils/__dirname.js";

export const description = "Explains every admin command";

const fields = await Promise.all(readdirSync(__dirname(import.meta.url))
	.filter(f => f[0] !== "~" && f.endsWith(".js"))
	.map(async file => {
		if(file === "help.js")
			return { name: "help", value: description };
		else
		{
			const { description } = await import(`./${file}`);
			return { name: file.slice(0, -3), value: description };
		}
	})
);

export const run = inter => inter.reply({flags: "Ephemeral", embeds: [{ fields }]});
