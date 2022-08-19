"use strict";

const { search } = require("../../steam_news/api");
const { unwatch, getAppName, getWatchedApps, getWatchedPrices } = require("../../steam_news/watchers");

const updateCmd = require(".").updateCmd.bind(null, exports);

exports.shouldCreateFor = id => getWatchedApps(id).length || getWatchedPrices(id).length;

exports.defaultMemberPermissions = "0";
exports.description = "(admins only) Stop watching a game’s news feed.";
const [appidOption] = exports.options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	choices: [],
}];
exports.getOptions = guildId => {
	const watchedApps = getWatchedApps(guildId).map(({name, appid}) => ({ name, value: ""+appid }));
	const watchedPrices = getWatchedPrices(guildId).map(({name, appid}) => ({ name, value: ""+appid }));
	const options = [];
	if(watchedApps.length)
		options.push({
			type: SUBCOMMAND, name: "news",
			description: "(admins only) Stop watching a game’s news feed.",
			options: [{ ...appidOption, choices: watchedApps }],
		});

	if(watchedPrices.length)
		options.push({
			type: SUBCOMMAND, name: "price",
			description: "(admins only) Stop watching a game’s price.",
			options: [{ ...appidOption, choices: watchedPrices }],
		});

	return options;
}

exports.run = async inter => {
	const price = inter.options.getSubcommand() === "price";
	const appid = inter.options.getString("game");
	const name = getAppName(appid) || "This game";
	const unwatched = unwatch(appid, inter.guild, price) !== false;
	inter.reply({
		ephemeral: true,
		content: `${name}${price ? "’s price" : ""} ${unwatched ? "is no longer" : "was not being"} watched in this server.`,
	}).catch(error);

	if(unwatched)
		updateCmd(inter.guild);
}
