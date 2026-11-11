
import {
	filterName, STEAM,
	makeAutocomplete, allTypes,
	respond,
} from "../../../autocomplete/watched.js";
import { getWebhooks } from "../../../steam_news/db_api.js";
import { fixedDictionary } from "../../../utils/dictionaries.js";

/** @import {AutocompleteInteraction} from "discord.js" */

export { ALL as ALL_WEBHOOKS } from "../../../autocomplete/watched.js";


export const autocomplete = makeAutocomplete(allTypes);

/** @param {AutocompleteInteraction} inter */
export const autocompleteWithAll = makeAutocomplete(allTypes, true);


/** @param {AutocompleteInteraction} inter */
export function autocompleteWebhooks(inter, withAll = true)
{
	const search = inter.options.getFocused();
	const webhooks = getWebhooks(inter.guildId, false);
	respond(inter, webhooks, search ? filterName(search) : null, withAll);
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