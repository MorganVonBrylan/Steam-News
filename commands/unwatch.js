"use strict";

const { search } = require("../steam_news/api");
const { unwatch, getAppName } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = "(admins only) Stop watching a game’s news feed.";
exports.options = [{
	type: "STRING", name: "name", required: true,
	description: "The game’s name or id",
}];
exports.run = async inter => {
	let appid = inter.options.getString("name");

	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return inter.reply({ content: `No game matching "${appid}" found.`, ephemeral: true }).catch(error);
	}

	const name = getAppName(appid) || "This game";
	inter.reply({
		content: `${name} ${unwatch(appid, inter.guild) === false ? "was not being" : "is no longer"} watched in this server.`,
		ephemeral: true,
	})
}
