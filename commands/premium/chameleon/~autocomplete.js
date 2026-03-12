
import onAutocompleteError from "../../../autocomplete/_errorHandler.js";
import { getWatchedPrices, getWatchedApps } from "../../../steam_news/db_api.js";
import { gameToOption } from "../../../utils/commands.js";

/** @typedef {import("discord.js").AutocompleteInteraction} AutocompleteInteraction */

/**
 * Creates a filter for searching through game watchers.
 * @param {string} search Part of a game name to search for
 * @returns {(watcher: {name:string}) => boolean} the filter function
 */
function filterName(search) {
	search = search.toLowerCase();
	return ({name}) => name.toLowerCase().includes(search);
}

/**
 * Do the final processing of search results and respond to the autocomplete with them.
 * @param {AutocompleteInteraction} inter The interaction
 * @param {({appid:number, name:string})[]} news The news watchers
 * @param {({appid:number, name:string})[]} prices The price watchers
 * @param {?ReturnType<filterName>} filter What to filter the news and prices with. Leave null for no filtering.
 * @param {boolean} addAll Whether to add an "all" option at the top
 */
function respond(inter, news, prices, filter = null, addAll = false)
{
	const filteredNews = filter ? news.filter(filter) : news;
	const filteredPrices = filter ? prices.filter(filter) : prices;
	for(const news of filteredNews)
		news.appid = "n"+news.appid;
	for(const price of filteredPrices)
		price.appid = "p"+price.appid;

	const results = filteredNews.concat(filteredPrices)
		.sort((a, b) => a.name - b.name)
		.slice(0, addAll ? 24 : 25);
	const t = tr.set(inter.locale, "premium");
	const t_news = t("chameleon.news");
	const t_price = t("chameleon.price");
	for(const result of results)
		result.name = `[${result.appid[0] === "n" ? t_news : t_price}] ${result.name}`;

	const options = results.map(gameToOption);
	if(addAll)
		options.unshift({ name: t("chameleon.all"), value: "#all#" });

	return inter.respond(options).catch(onAutocompleteError);
}

export default autocomplete;
/** @param {AutocompleteInteraction} inter */
export function autocomplete(inter)
{
	const search = inter.options.getFocused();
	const watchedNews = getWatchedApps(inter.guildId);
	const watchedPrices = getWatchedPrices(inter.guildId);
	respond(inter, watchedNews, watchedPrices, search ? filterName(search) : null);
}