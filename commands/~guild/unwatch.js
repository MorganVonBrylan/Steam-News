
import onAutocompleteError from "../../autocomplete/_errorHandler.js";
import {
	getWatchedApps, getWatchedPrices, getWatchedGroups, isWatchingSteam,
	getAppName, getGroupName,
	unwatch, unwatchSteam, unwatchGroup,
} from "../../steam_news/watchers.js";
import { guildCommands } from "@brylan/djs-commands";
import { gameToOption, groupToOption } from "../../utils/commands.js";

const MAX_OPTIONS = 25;
const CMD_NAME = import.meta.filename.match(/([^\\/]+).js$/)[1];

export const updateCmd = guildCommands.updateCmd.bind(null, CMD_NAME);

export const defaultMemberPermissions = "0";

export function shouldCreateFor(id) {
	return isWatchingSteam(id) || getWatchedApps(id).length || getWatchedPrices(id).length;
}


import getLocalizationHelper from "./~localizationHelper.js";
import { fixedDictionary, generateDictionary as generateSubcommands } from "../../utils/dictionaries.js";
const localizations = getLocalizationHelper(CMD_NAME);

const subcommands = generateSubcommands(["news", "price", "steam", "group"],
	name => ({ type: SUBCOMMAND, name, ...localizations.optionLocalizations(name) }));


const watcherGetters = fixedDictionary({
	news: { getWatched: getWatchedApps, toOptions: gameToOption },
	price: { getWatched: getWatchedPrices, toOptions: gameToOption },
	group: { getWatched: getWatchedGroups, toOptions: groupToOption },
});

// middleware takes care of translating these
const appidOption = {
	type: INTEGER, name: "game", required: true,
	description: "The game’s name or id",
};
const clanidOption = {
	type: INTEGER, name: "name", required: true,
	description: "The group’s name",
}
export const options = [appidOption, clanidOption];
export function getOptions(guildId)
{
	const options = [];
	for(const [type, { getWatched, toOptions }] of Object.entries(watcherGetters))
	{
		const watchers = getWatched(guildId).map(toOptions);
		if(!watchers.length)
			continue;

		const watcherOption = { ...(type === "group" ? clanidOption : appidOption) };
		if(watchers.length <= MAX_OPTIONS)
			watcherOption.choices = watchers.sort();
		else
			watcherOption.autocomplete = true;
		options.push({ ...subcommands[type], options: [watcherOption] });
	}
	
	if(isWatchingSteam(guildId))
		options.push(subcommands.steam);

	return options;
}

/** @param {import("discord.js").AutocompleteInteraction} inter */
export function autocomplete(inter)
{
	/** @type {keyof watcherGetters} */
	const subcommand = inter.options.getSubcommand();
	const search = inter.options.getFocused().toLowerCase();
	const { getWatched, toOptions } = watcherGetters[subcommand];
	const watchers = getWatched(inter.guildId);
	const results = (search ? watchers.filter(({name}) => name.toLowerCase().includes(search)) : watchers);

	inter.respond(results.slice(0, 25).map(toOptions)).catch(onAutocompleteError);
}

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const subcommand = inter.options.getSubcommand();
	let unwatched = true, name, trKey;
	if(subcommand === "steam")
	{
		unwatchSteam(inter.guildId);
		trKey = "steam.unwatched";
	}
	else if(subcommand === "group")
	{
		const clanid = inter.options.getInteger("name");
		name = getGroupName(clanid) || "This group";
		unwatched = unwatchGroup(clanid, inter.guild);
		trKey = `unwatch.group-${unwatched ? "unwatched" : "unchanged"}`;
	}
	else
	{
		const appid = inter.options.getInteger("game");
		name = getAppName(appid) || "This game";
		unwatched = unwatch(appid, inter.guild, subcommand === "price");
		trKey = `unwatch.${subcommand}-${unwatched ? "unwatched" : "unchanged"}`;
	}

	inter.reply({ flags: "Ephemeral", content: tr.get(inter.locale, trKey, name) });
	if(unwatched)
		updateCmd(inter.guild);
}
