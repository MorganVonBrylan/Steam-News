"use strict";

const { unwatch, getAppName } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = "(admins only) Stop watching a game’s news feed.";
exports.options = [{
	type: "INTEGER", name: "id",
	description: "The game’s id", required: true
}];
exports.run = inter => {
	const appid = inter.options.getInteger("id");
	const name = getAppName(appid) || "This game";
	inter.reply({
		content: `${name} ${unwatch(appid, inter.guild) === false ? "was not being" : "is no longer"} watched in this server.`,
		ephemeral: true,
	})
}
