
import onError from "./_errorHandler.js";
import { search } from "../steam_news/api.js";

/** @param {import("discord.js").AutocompleteInteraction} inter */
const resultToOption = ({ id, name }) => ({
	name: name.length > 100 ? name.substring(0, 99) + "…" : name,
	value: "" + id,
});

export default all;
/** @param {import("discord.js").AutocompleteInteraction} inter */
export function all(inter)
{
	search(inter.options.getFocused()).then(results => {
		inter.respond(results.map(resultToOption)).catch(onError);
	});
}

/** @param {import("discord.js").AutocompleteInteraction} inter */
export function appsOnly(inter)
{
	search(inter.options.getFocused()).then(results => {
		const options = results.filter(({type}) => type === "app").map(resultToOption);
		inter.respond(options).catch(onError);
	});
}
