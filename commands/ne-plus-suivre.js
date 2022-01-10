"use strict";

const { unwatch, getAppName } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = "(admins seulement) Cesser de suivre les actus d'un jeu";
exports.options = [{
	type: "INTEGER", name: "id",
	description: "L'id du jeu", required: true
}];
exports.run = inter => {
	const appid = inter.options.getInteger("id");
	const name = getAppName(appid) || "Ce jeu";
	inter.reply({
		content: `${name} ${unwatch(appid, inter.guild) ? "n'est plus" : "n'était pas"} suivi dans ce serveur.`,
		ephemeral: true,
	})
}
