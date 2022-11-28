"use strict";

const { search } = require("../../steam_news/api");
const { unwatch, getAppName, getWatchedApps, getWatchedPrices } = require("../../steam_news/watchers");

const updateCmd = require(".").updateCmd.bind(null, exports);

exports.shouldCreateFor = id => getWatchedApps(id).length || getWatchedPrices(id).length;

const localizations = Object.entries(tr.getAll("commands.unwatch", true));
localizations.get = function(property) {
	return this.reduce((localization, [locale, tr]) => {
		localization[locale] = tr[property];
		return localization;
	}, {});
}
localizations.optionLocalizations = function(optionName) {
	return this.reduce((optLocalization, [locale, tr]) => {
		const {name, description} = tr.options[optionName];
		optLocalization.nameLocalizations[locale] = name;
		optLocalization.descriptionLocalizations[locale] = description;
		return optLocalization;
	}, {
		nameLocalizations: {},
		descriptionLocalizations: {},
	});
}


exports.defaultMemberPermissions = "0";
exports.nameLocalizations = localizations.get("name");
exports.description = tr.cmdDescription("unwatch");
exports.descriptionLocalizations = localizations.get("description");
const unwatchNews = {
	type: SUBCOMMAND, name: "news",
	description: "(admins only) Stop watching a game’s news feed.",
	...localizations.optionLocalizations("news"),
};
const unwatchPrice = {
	type: SUBCOMMAND, name: "price",
	description: "(admins only) Stop watching a game’s price.",
	...localizations.optionLocalizations("price"),
}
const [appidOption] = exports.options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	...localizations.optionLocalizations("game"),
	choices: [],
}];
exports.getOptions = guildId => {
	function formatName(name) {
		return name.length > 32 ? name.substring(0, 31) + "…" : name;
	}
	const watchedApps = getWatchedApps(guildId).map(({name, appid}) => ({ name: formatName(name), value: ""+appid }));
	const watchedPrices = getWatchedPrices(guildId).map(({name, appid}) => ({ name: formatName(name), value: ""+appid }));
	const options = [];
	if(watchedApps.length)
		options.push({
			...unwatchNews,
			options: [{ ...appidOption, choices: watchedApps }],
		});

	if(watchedPrices.length)
		options.push({
			...unwatchPrice,
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
		content: tr.get(inter.locale, `unwatch.${price ? "price" : "news"}-${unwatched ? "unwatched" : "unchanged"}`, name),
	}).catch(error);

	if(unwatched)
		updateCmd(inter.guild);
}
