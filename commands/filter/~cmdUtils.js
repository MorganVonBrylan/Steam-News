
import { premiumSKU, goldSKU, buttons } from "../../steam_news/VIPs.js";
export const storeButtons = buttons(premiumSKU, goldSKU);

/**
 * Translate a filter
 * @param {(key:string, filter:string)=>string} t Translator function, set to "filter"
 * @param {import("./~data.js").Filter} filter The filter to translate
 */
export function translateFilter(t, {filter})
{
	const [, ...lines] = filter.split("\n");
	return lines.map(translateFilterLine.bind(null, t)).join("\n");
}

/**
 * Format a filter line
 * @param {(key:string, filter:string)=>string} t Translator function, set to "filter"
 * @param {`${"+"|"-"}${string}`} filter Terms to filter, separated by commas
 */
function translateFilterLine(t, filter)
{
	const typeKey = filter[0] === "-" ? "exclude"
		: filter.includes(",") ? "require-one-of" : "require";
	const terms = filter.substring(1).split(",");
	return t(typeKey, `\`${terms.join("`, `")}\``);
}