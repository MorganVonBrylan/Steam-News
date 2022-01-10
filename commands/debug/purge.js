"use strict";

const { purgeApp, purgeGuild } = require("../../steam_news/watchers");

exports.description = "Purge une appli ou un serveur.";
exports.options = [{
	type: "STRING", name: "quoi",
	description: "Que faut-il purger ?", required: true,
	choices: [{ name: "appli", value: "app" }, { name: "serveur", value: "guild" }],
}, {
	type: "STRING", name: "id",
	description: "L'id de l'appli ou du serveur à purger", required: true
}];
exports.run = inter => {
	const app = inter.options.getString("quoi") === "app";
	inter.reply({
		content: (app ? purgeApp : purgeGuild)(inter.options.getString("id"))
			? (app ? "Appli purgée." : "Serveur purgé.")
			: "Il n'y avait rien à purger.",
		ephemeral: true,
	}).catch(error);
};
