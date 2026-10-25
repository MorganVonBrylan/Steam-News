
import onAutocompleteError from "../../autocomplete/_errorHandler.js";
import { getFilters, setFilter, getAppName } from "../../steam_news/db_api.js";
import { gameToOption } from "../../utils/commands.js";

export const options = [{
	type: NUMBER, name: "game", required: true,
	description: "The game to remove the filter of",
	autocomplete: true,
}];
/** @param {import("discord.js").AutocompleteInteraction} inter */
export function autocomplete(inter)
{
	const search = inter.options.getFocused().toLowerCase();
	const filters = getFilters(inter.guildId);
	const results = search ? filters.filter(({name}) => name.toLowerCase().includes(search)) : filters;

	inter.respond(results.slice(0, 25).map(gameToOption)).catch(onAutocompleteError);
}

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter)
{
	const t = tr.set(inter.locale, "filter");
	const appid = inter.options.getNumber(inter, true);
	const { changes } = setFilter(null, appid);
	if(changes)
		inter.reply(t("removed", getAppName(appid)));
	else
		inter.reply({flags: "Ephemeral", content: t("remove-failed")});
}