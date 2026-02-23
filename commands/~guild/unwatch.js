
import onAutocompleteError from "../../autocomplete/_errorHandler.js";
import {
	unwatch,
	getAppName, getWatchedApps, getWatchedPrices
} from "../../steam_news/watchers.js";
import { guildCommands } from "@brylan/djs-commands";
import { gameToOption } from "../../utils/commands.js";

const MAX_OPTIONS = 25;
const CMD_NAME = "unwatch";

const updateCmd = guildCommands.updateCmd.bind(null, CMD_NAME);

export function shouldCreateFor(id) {
	return getWatchedApps(id).length || getWatchedPrices(id).length;
}


import getLocalizationHelper from "./~localizationHelper.js";
const localizations = getLocalizationHelper(CMD_NAME);

export const defaultMemberPermissions = "0";
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
const appidOption = {
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	// middleware takes care of translating this
	choices: [],
};
export const options = [appidOption];
export function getOptions(guildId)
{
	const watchedApps = getWatchedApps(guildId).map(gameToOption);
	const watchedPrices = getWatchedPrices(guildId).map(gameToOption);
	const nApps = watchedApps.length;
	const nPrices = watchedPrices.length;
	const options = [];
	if(nApps)
		options.push({
			...unwatchNews,
			options: [{
				...appidOption,
				...(nApps > MAX_OPTIONS ? {autocomplete: true} : {choices: watchedApps.sort()}),
			}],
		});

	if(nPrices)
		options.push({
			...unwatchPrice,
			options: [{
				...appidOption,
				...(nPrices > MAX_OPTIONS ? {autocomplete: true} : {choices: watchedPrices.sort()}),
			}],
		});

	return options;
}

/** @param {import("discord.js").AutocompleteInteraction} inter */
export function autocomplete(inter)
{
	const search = (inter.options.getFocused() || "").toLowerCase();
	const apps = (inter.options.getSubcommand() === "price" ? getWatchedPrices : getWatchedApps)(inter.guildId);
	const results = (search ? apps.filter(({name}) => name.toLowerCase().includes(search)) : apps);

	inter.respond(results.slice(0, 25).map(gameToOption)).catch(onAutocompleteError);
}

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const price = inter.options.getSubcommand() === "price";
	const appid = inter.options.getString("game");
	const name = getAppName(appid) || "This game";
	const unwatched = unwatch(appid, inter.guild, price) !== false;
	const trKey = `unwatch.${price ? "price" : "news"}-${unwatched ? "unwatched" : "unchanged"}`;
	inter.reply({
		flags: "Ephemeral",
		content: tr.get(inter.locale, trKey, name),
	});

	if(unwatched)
		updateCmd(inter.guild);
}
