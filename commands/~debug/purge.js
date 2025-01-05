
import { purgeApp, purgeGuild } from "../../steam_news/watchers.js";

export const description = "Purge an app or a server.";
export const options = [{
	type: STRING, name: "what",
	description: "What should be purged?", required: true,
	choices: [{ name: "app", value: "app" }, { name: "server", value: "guild" }],
}, {
	type: STRING, name: "id",
	description: "The id of the server or app to purge", required: true
}];
export function run(inter)
{
	const app = inter.options.getString("what") === "app";
	inter.reply({flags: "Ephemeral",
		content: (app ? purgeApp : purgeGuild)(inter.options.getString("id"))
			? (app ? "App purgée." : "Server purgé.")
			: "There was nothing to purge.",
	});
}
