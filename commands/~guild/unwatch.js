
import onAutocompleteError from "../../autocomplete/_errorHandler.js";
import {
	unwatch, unwatchSteam,
	getAppName, getWatchedApps, getWatchedPrices, isWatchingSteam,
} from "../../steam_news/watchers.js";
import { guildCommands } from "@brylan/djs-commands";
import { gameToOption } from "../../utils/commands.js";

const MAX_OPTIONS = 25;
const CMD_NAME = import.meta.filename.match(/([^\\/]+).js$/)[1];

export const updateCmd = guildCommands.updateCmd.bind(null, CMD_NAME);

export const defaultMemberPermissions = "0";

export function shouldCreateFor(id) {
	return isWatchingSteam(id) || getWatchedApps(id).length || getWatchedPrices(id).length;
}


import getLocalizationHelper from "./~localizationHelper.js";
import { generateDictionary as generateSubcommands } from "../../utils/dictionaries.js";
const localizations = getLocalizationHelper(CMD_NAME);

const subcommands = generateSubcommands(["news", "price", "steam"],
	name => ({ type: SUBCOMMAND, name, ...localizations.optionLocalizations(name) }));

const appidOption = {
	type: INTEGER, name: "game", required: true,
	description: "The game’s name or id",
	// middleware takes care of translating this
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
			...subcommands.news,
			options: [{
				...appidOption,
				...(nApps > MAX_OPTIONS ? {autocomplete: true} : {choices: watchedApps.sort()}),
			}],
		});

	if(nPrices)
		options.push({
			...subcommands.price,
			options: [{
				...appidOption,
				...(nPrices > MAX_OPTIONS ? {autocomplete: true} : {choices: watchedPrices.sort()}),
			}],
		});
	
	if(isWatchingSteam(guildId)) // déplace les traductions
		options.push(subcommands.steam);

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
	const subcommand = inter.options.getSubcommand();
	if(subcommand === "steam")
	{
		unwatchSteam(inter.guildId);
		inter.reply({ flags: "Ephemeral", content: tr.get(inter.locale, "steam.unwatched") });
		updateCmd(inter.guild);
		return;
	}

	const price = subcommand === "price";
	const appid = inter.options.getInteger("game");
	const name = getAppName(appid) || "This game";
	const unwatched = unwatch(appid, inter.guild, price);
	const trKey = `unwatch.${price ? "price" : "news"}-${unwatched ? "unwatched" : "unchanged"}`;
	inter.reply({
		flags: "Ephemeral",
		content: tr.get(inter.locale, trKey, name),
	});

	if(unwatched)
		updateCmd(inter.guild);
}
