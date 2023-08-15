"use strict";

const { purgeApp, purgeGuild } = require("../../steam_news/watchers");

exports.description = "Purge an app or a server.";
exports.options = [{
	type: STRING, name: "what",
	description: "What should be purged?", required: true,
	choices: [{ name: "app", value: "app" }, { name: "server", value: "guild" }],
}, {
	type: STRING, name: "id",
	description: "The id of the server or app to purge", required: true
}];
exports.run = inter => {
	const app = inter.options.getString("what") === "app";
	inter.reply({ephemeral: true,
		content: (app ? purgeApp : purgeGuild)(inter.options.getString("id"))
			? (app ? "App purgée." : "Server purgé.")
			: "There was nothing to purge.",
	}).catch(error);
};
