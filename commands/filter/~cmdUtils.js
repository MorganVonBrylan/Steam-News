
import { premiumSKU, goldSKU, buttons } from "../../steam_news/VIPs.js";
export const storeButtons = buttons(premiumSKU, goldSKU);

/**
 * Translate a filter
 * @param {TranslatorFunction} t Translator function set to "filter"
 * @param {import("./~data.js").Filter} filter The filter to translate
 */
export function translateFilter(t, {filter})
{
	const [, ...lines] = filter.split("\n");
	return lines.map(translateFilterLine.bind(null, t)).join("\n");
}

/**
 * Format a filter line
 * @param {TranslatorFunction} t Translator function set to "filter"
 * @param {`${"+"|"-"}${string}`} filter Terms to filter, separated by commas
 */
function translateFilterLine(t, filter)
{
	const typeKey = filter[0] === "-" ? "exclude"
		: filter.includes(",") ? "require-one-of" : "require";
	const terms = filter.substring(1).split(",");
	return t(typeKey, `\`${terms.join("`, `")}\``);
}


/**
 * @extends Set<string>
 * Wrapper for a set of filter terms (or keywords) that retains its type, with a useful toString method.
 */
export class Terms extends Set {
	/** @param {string[]|`${"+"|"-"}${string}`} terms @param {"+"|"-"} type */
	constructor(terms, type = terms[0]) {
		super(Array.isArray(terms) ? terms : terms.substring(1).split(","));
		this.type = type;
	}
	#assignPropsTo(set) {
		set.type = this.type;
		set.toString = this.toString;
		return set;
	}
	/** @param {Set<string>} other @returns {typeof this} @see Set.prototype.union */
	union(other) {
		return this.#assignPropsTo(super.union(other));
	}
	/** @param {Set<string>} other @returns {typeof this} @see Set.prototype.difference */
	difference(other) {
		return this.#assignPropsTo(super.difference(other));
	}
	toString() {
		return `${this.type}${Array.from(this)}`;
	}
}