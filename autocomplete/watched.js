
import onError from "./_errorHandler.js";
import { STEAM_APPID } from "../steam_news/api.js";
import { getWatchedPrices, getWatchedApps, getWatchedGroups } from "../steam_news/db_api.js";
import { gameToOption } from "../utils/commands.js";

/** @import {AutocompleteInteraction} from "discord.js" */
/** @import {WatcherType} from "../steam_news/db_api.js" */

/** @type {readonly WatcherType[]} */
export const allTypes = Object.freeze(["news", "steam", "price", "group"]);

const getWatched = Object.freeze({
	news: getWatchedApps,
	price: getWatchedPrices,
	group: getWatchedGroups,
});

export const STEAM = `n${STEAM_APPID}`;
export const ALL = "#all#";

/**
 * Creates a filter for searching through game watchers.
 * @param {string} search Part of a game name to search for
 * @returns {(watcher: {name:string}) => boolean} the filter function
 */
export function filterName(search) {
	search = search.toLowerCase();
	return ({name}) => name.toLowerCase().includes(search);
}


/**
 * Respond to an autocomplete search with watched apps, prices and/or groups.
 * @param {WatcherType[]} watcherTypes
 * @param {boolean} [withAll] Whether to include an "all watchers" option at the top (default: no)
 * @return {(inter:AutocompleteInteraction)=>Promise}
 */
export function makeAutocomplete(watcherTypes, withAll)
{
	watcherTypes = new Set(watcherTypes);
	const withSteam = watcherTypes.has("steam");
	watcherTypes.delete("steam");
	for(const type of watcherTypes)
		if(!(type in getWatched))
			throw new RangeError("Invalid watcher type", { cause: type });

	const getters = Object.freeze(Array.from(watcherTypes, type => [type, getWatched[type]]));
	return inter => {
		const { guildId } = inter;
		const search = inter.options.getFocused();
		const watched = {};
		for(const [type, getter] of getters)
			watched[type] = type === "news" ? getter(guildId, withSteam) : getter(guildId);
		respond(inter, watched, search ? filterName(search) : null, withAll);
	};
}


/**
 * @param {AutocompleteInteraction} inter
 * @param {boolean} [withAll] Whether to include an "all watchers" option at the top (default: no)
 */
export function all(inter, withAll = false)
{
	const search = inter.options.getFocused();
	const { guildId } = inter;
	const news = getWatchedApps(guildId, true);
	const prices = getWatchedPrices(guildId);
	const groups = getWatchedGroups(guildId);
	respond(inter, { news, prices, groups }, search ? filterName(search) : null, withAll);
}


/** @typedef {{appid:number, name:string}} App */
/** @typedef {{clanid:number, name:string}} Group */
/**
 * Do the final processing of search results and respond to the autocomplete with them.
 * @param {AutocompleteInteraction} inter The interaction
 * @param {{news?:App[], price?:App[], steam?:App, group?:Group[]}} results The apps & groups
 * @param {?ReturnType<filterName>} filter What to filter the news and prices with. Leave null for no filtering.
 * @param {boolean} addAll Whether to add an "all" option at the top
 */
export function respond(inter, results, filter = null, addAll = false)
{
	if(results.steam)
		(results.news ??= []).push(results.steam);
	
	/** @type {(App|Group)[][]} */
	const filteredResults = [];
	for(const type in results)
	{
		if(type !== "news" && type !== "price" && type !== "group")
			continue;
		const filtered = filter ? results[type].filter(filter) : results[type];
		for(const watcher of filtered)
			watcher.appid = `${type[0]}${watcher.appid || watcher.clanid}`;
		filteredResults.push(filtered);
	}

	// This was originally code exclusive to the chameleon autocompletes, and it's just more efficient to leave the strings where they were
	const t = tr.set(inter.locale, "premium.chameleon");
	const type = { n: t("news"), p: t("price"), g: t("group") };

	const options = filteredResults.flat()
		.sort((a, b) => a.appid === STEAM ? -1000
			: b.appid === STEAM ? 1000
			: a.name > b.name ? 1 : -1)
		.slice(0, addAll ? 24 : 25)
		.map(({appid, name}) => gameToOption({appid, name: `[${type[appid[0]]}] ${name}`}));

	if(addAll)
		options.unshift({name: t("all"), value: ALL});
	return inter.respond(options).catch(onError);
}
