
import onAutocompleteError from "../../../autocomplete/_errorHandler.js";
import { getWatchedPrices, getWatchedApps } from "../../../steam_news/db_api.js";
import { gameToOption } from "../../../utils/commands.js";

/**
 * Creates a filter for searching through game watchers.
 * @param {string} search Part of a game name to search for
 * @returns {(watcher: {name:string}) => boolean} the filter function
 */
function filterName(search) {
	search = search.toLowerCase();
	return ({name}) => name.toLowerCase().includes(search);
}

export default autocomplete;
/** @param {import("discord.js").AutocompleteInteraction} inter */
export function autocomplete(inter)
{
	const search = inter.options.getFocused();
	const watchedNews = getWatchedApps(inter.guildId);
	const watchedPrices = getWatchedPrices(inter.guildId);

	const filter = search ? filterName(search) : () => true;
	const filteredNews = search ? watchedNews.filter(filter) : watchedNews;
	const filteredPrices = search ? watchedPrices.filter(filter) : watchedPrices;
	for(const news of filteredNews)
		news.appid = "n"+news.appid;
	for(const price of filteredPrices)
		price.appid = "p"+price.appid;

	const results = filteredNews.concat(filteredPrices)
		.sort((a, b) => a.name - b.name)
		.slice(0, 25);

	const t = tr.set(inter.locale, "premium");
	const t_news = t("chameleon.news");
	const t_price = t("chameleon.price");
	for(const result of results)
		result.name = `[${result.appid[0] === "n" ? t_news : t_price}] ${result.name}`;

	inter.respond(results.map(gameToOption)).catch(onAutocompleteError);
}