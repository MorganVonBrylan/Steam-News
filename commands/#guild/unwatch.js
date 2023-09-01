"use strict";

const { unwatch, getAppName, getWatchedApps, getWatchedPrices } = require("../../steam_news/watchers");

const MAX_OPTIONS = 25;

function toString() {
	return this.name;
}
function formatName(name) {
	return name.length > 32 ? name.substring(0, 31) + "…" : name;
}

const updateCmd = require("@brylan/djs-commands").guildCommands.updateCmd.bind(null, exports);

exports.shouldCreateFor = id => getWatchedApps(id).length || getWatchedPrices(id).length;


const localizations = require("./#localizationHelper")("unwatch");

exports.defaultMemberPermissions = "0";
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
	// middleware takes care of translating this
	choices: [],
}];
exports.getOptions = guildId => {
	const watchedApps = getWatchedApps(guildId).map(({name, appid}) => ({ name: formatName(name), value: ""+appid, toString }));
	const watchedPrices = getWatchedPrices(guildId).map(({name, appid}) => ({ name: formatName(name), value: ""+appid, toString }));
	const nApps = watchedApps.length; const nPrices = watchedPrices.length;
	const options = [];
	if(nApps)
		options.push({
			...unwatchNews,
			options: [{ ...appidOption, ...(nApps > MAX_OPTIONS ? {autocomplete: true} : {choices: watchedApps.sort()}) }],
		});

	if(nPrices)
		options.push({
			...unwatchPrice,
			options: [{ ...appidOption, ...(nPrices > MAX_OPTIONS ? {autocomplete: true} : {choices: watchedPrices.sort()}) }],
		});

	return options;
}

exports.autocomplete = inter => {
	const search = (inter.options.getFocused() || "").toLowerCase();
	const apps = (inter.options.getSubcommand() === "price" ? getWatchedPrices : getWatchedApps)(inter.guild.id);
	const results = (search ? apps.filter(({name}) => name.toLowerCase().includes(search)) : apps);

	inter.respond(results.slice(0, 25).map(({name, appid}) => ({ name: formatName(name), value: ""+appid }))).catch(error);
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
