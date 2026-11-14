
import onAutocompleteError from "../../autocomplete/_errorHandler.js";
import { filterName, makeOptionMaker,  } from "../../autocomplete/watched.js";
import { getFilters, setFilter, getAppName, getGroupName } from "../../steam_news/db_api.js";
import { gameToOption } from "../../utils/commands.js";

export const options = [{
	type: STRING, name: "game-or-group", required: true,
	description: "The game/group to remove the filter of",
	autocomplete: true,
}];
/** @param {import("discord.js").AutocompleteInteraction} inter */
export function autocomplete(inter)
{
	const { makeOption } = makeOptionMaker();
	const search = inter.options.getFocused();
	const filters = getFilters(inter.guildId);
	const options = (search ? filters.filter(filterName(search)) : filters)
		.slice(0, 25)
		.map(({appid, clanid, name}) => makeOption(clanid ? `g${clanid}` : `n${appid}`, name));
	inter.respond(options).catch(onAutocompleteError);
}

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter)
{
	const t = tr.set(inter.locale, "filter");
	const appOrClanId = inter.options.getString("game-or-group", true);
	const { guildId } = inter;
	const type = appOrClanId[0] === "g" ? "clanid" : "appid";
	const id = +appOrClanId.substring(1);
	const { changes } = setFilter({ filter: null, [type]: id, guildId });
	if(changes)
		inter.reply(t("removed", (type === "appid" ? getAppName : getGroupName)(id)));
	else
		inter.reply({flags: "Ephemeral", content: t("remove-failed")});
}