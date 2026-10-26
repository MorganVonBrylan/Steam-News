
import onAutocompleteError from "../../autocomplete/_errorHandler.js";
import { getAppName, getFilters, getWatchedApps, setFilter } from "../../steam_news/db_api.js";
import { gameToOption } from "../../utils/commands.js";
import { dbl_link, MAX_FREE, MAX_WITH_VOTE } from "./~data.js";
import { votedDBL, premiumGuilds, premiumSKU, goldSKU, buttons } from "../../steam_news/VIPs.js";
const premiumButtons = buttons(premiumSKU, goldSKU);

export const options = [{
	type: NUMBER, name: "game", required: true,
	description: "The game to set a filter for",
	autocomplete: true,
}, {
	type: STRING, name: "type", required: true,
	description: "Whether to require or exclude the keywords",
	choices: [{ name: "Require", value: "+" }, { name: "Exclude", value: "-" }],
}, {
	type: STRING, name: "filter", required: true,
	description: "The keywords to filter, separated by commas.",
}];
/** @param {import("discord.js").AutocompleteInteraction} inter */
export function autocomplete(inter)
{
	const search = inter.options.getFocused().toLowerCase();
	const watchers = getWatchedApps(inter.guildId);
	const results = search ? watchers.filter(({name}) => name.toLowerCase().includes(search)) : watchers;

	inter.respond(results.slice(0, 25).map(gameToOption)).catch(onAutocompleteError);
}

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "filter");
	const { guildId, options } = inter;
	const appid = options.getNumber("game", true);
	const isPremium = premiumGuilds.has(guildId);
	const hasVoted = isPremium || votedDBL(inter.user.id);
	const { [appid]: existingFilter, length: nFilters } = getFilters(guildId, true);
	if(!existingFilter && !isPremium && nFilters >= (hasVoted ? MAX_WITH_VOTE : MAX_FREE))
	{
		inter.reply({
			flags: "Ephemeral",
			content: hasVoted
				? t("at-maximum", MAX_WITH_VOTE)
				: t("at-maximum-plzvote", { dbl_link }),
		});
		return;
	}

	const type = options.getString("type");
	const filter = options.getString("filter").toLowerCase();
	const { changes } = setFilter({filter: type + filter, appid, guildId});
	if(changes)
	{
		const newNFilters = existingFilter ? nFilters : nFilters+1;
		const hasFiltersLeft = isPremium || hasVoted && newNFilters < MAX_WITH_VOTE;
		let reply = t("added", existingFilter?.name || getAppName(appid));
		reply = `${reply}\n${t(type === "+" ? "require" : "exclude", `\`${filter}\``)}`;

		if(hasFiltersLeft)
			reply = { embeds: [{ description: reply, }] };
		else
		{
			const callToAction = newNFilters === MAX_WITH_VOTE
				? t("at-maximum", MAX_WITH_VOTE)
				: t("reached-maximum-plzvote", { dbl_link });
			reply = {
				embeds: [{ description: `${reply}\n\n-# ${callToAction}` }],
				components: [premiumButtons],
			};
		}
		inter.reply(reply);
	}
	else
		inter.reply({flags: "Ephemeral", content: t("add-failed")});
}