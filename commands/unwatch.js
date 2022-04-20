"use strict";

const { search } = require("../steam_news/api");
const { unwatch, getAppName, getWatchedApps } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = "(admins only) Stop watching a game’s news feed.";
exports.options = [{
	type: "STRING", name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
exports.run = async inter => {
	let appid = inter.options.getString("game");

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

exports.autocomplete = inter => {
	inter.respond(getWatchedApps(inter.guild.id).map(({name, appid}) => ({ name, value: ""+appid })));
}
