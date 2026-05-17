
import onAutocompleteError from "../../../autocomplete/_errorHandler.js";
import { STEAM_APPID } from "../../../steam_news/api.js";
import {
	getWatchedPrices, getWatchedApps, getWatchedGroups,
	getWebhooks,
} from "../../../steam_news/db_api.js";
import { gameToOption } from "../../../utils/commands.js";
import { fixedDictionary } from "../../../utils/dictionaries.js";

/** @typedef {import("discord.js").AutocompleteInteraction} AutocompleteInteraction */

export const ALL_WEBHOOKS = "#all#";

/**
 * Creates a filter for searching through game watchers.
 * @param {string} search Part of a game name to search for
 * @returns {(watcher: {name:string}) => boolean} the filter function
 */
function filterName(search) {
	search = search.toLowerCase();
	return ({name}) => name.toLowerCase().includes(search);
}

const STEAM = `n${STEAM_APPID}`;
/**
 * Do the final processing of search results and respond to the autocomplete with them.
 * @param {AutocompleteInteraction} inter The interaction
 * @param {{appid:number, name:string}[]} news The news watchers
 * @param {{appid:number, name:string}[]} prices The price watchers
 * @param {{clanid:number, name:string}[]} groups The group watchers
 * @param {?ReturnType<filterName>} filter What to filter the news and prices with. Leave null for no filtering.
 * @param {boolean} addAll Whether to add an "all" option at the top
 */
function respond(inter, news, prices, groups, filter = null, addAll = false)
{
	const filteredNews = filter ? news.filter(filter) : news;
	const filteredPrices = filter ? prices.filter(filter) : prices;
	const filteredGroups = filter ? groups.filter(filter) : groups;
	for(const news of filteredNews)
		news.appid = "n"+news.appid;
	for(const price of filteredPrices)
		price.appid = "p"+price.appid;
	for(const group of filteredGroups)
		group.appid = "g"+group.clanid;

	const t = tr.set(inter.locale, "premium.chameleon");
	const type = { n: t("news"), p: t("price"), g: t("group") };

	const results = filteredNews.concat(filteredPrices, filteredGroups)
		.sort((a, b) => a.appid === STEAM ? -1000
			: b.appid === STEAM ? 1000
			: a.name > b.name ? 1 : -1)
		.slice(0, addAll ? 24 : 25)
		.map(({appid, name}) => gameToOption({appid, name: `[${type[appid[0]]}] ${name}`}));

	const options = addAll ? [{name: t("all"), value: ALL_WEBHOOKS}].concat(results) : results;
	return inter.respond(options).catch(onAutocompleteError);
}

export default autocomplete;
/**
 * @param {AutocompleteInteraction} inter
 * @param {boolean} [withAll] Whether to include an "all watchers" option at the top (default: no)
 * */
export function autocomplete(inter, withAll = false)
{
	const search = inter.options.getFocused();
	const { guildId } = inter;
	const news = getWatchedApps(guildId, true);
	const prices = getWatchedPrices(guildId);
	const groups = getWatchedGroups(guildId);
	respond(inter, news, prices, groups, search ? filterName(search) : null, withAll);
}

export function autocompleteWithAll(inter)
{
	return autocomplete(inter, true);
}


/** @param {AutocompleteInteraction} inter */
export function autocompleteWebhooks(inter, withAll = true)
{
	const search = inter.options.getFocused();
	const { news, price, steam, group } = getWebhooks(inter.guildId, false);
	if(steam)
		news.push(steam);
	respond(inter, news, price, group, search ? filterName(search) : null, withAll);
}



const TYPES = fixedDictionary({n: "news", p: "price", g: "group"});
/**
 * Parse an option into its type and appid
 * @param {string} value The option's value
 * @returns {{appid:number, type:import("../../../steam_news/db_api.js").WatcherType}}
 */
export function parseOption(value)
{
	return {
		appid: +value.substring(1),
		type: value === STEAM ? "steam" : TYPES[value[0]],
	};
}