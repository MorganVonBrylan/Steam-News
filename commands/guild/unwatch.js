"use strict";

const { search } = require("../../steam_news/api");
const { unwatch, getAppName, getWatchedApps } = require("../../steam_news/watchers");

const updateCmd = require(".").updateCmd.bind(null, exports);

exports.shouldCreateFor = id => !!getWatchedApps(id).length;

exports.adminOnly = true;
exports.description = "(admins only) Stop watching a game’s news feed.";
exports.options = [{
	type: "STRING", name: "game", required: true,
	description: "The game’s name or id",
	choices: [],
}];
exports.getOptions = guildId => {
	exports.options[0].choices = getWatchedApps(guildId).map(({name, appid}) => ({ name, value: ""+appid }));
	return exports.options;
}
exports.run = async inter => {
	const appid = inter.options.getString("game");
	const name = getAppName(appid) || "This game";
	const unwatched = unwatch(appid, inter.guild) !== false;
	inter.reply({
		ephemeral: true,
		content: `${name} ${unwatched ? "is no longer" : "was not being"} watched in this server.`,
	}).catch(error);

	if(unwatched)
		updateCmd(inter.guild);
}
