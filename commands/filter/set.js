
import onAutocompleteError from "../../autocomplete/_errorHandler.js";
import { getAppName, getFilters, getWatchedApps, setFilter } from "../../steam_news/db_api.js";
import { gameToOption } from "../../utils/commands.js";
import { dbl_url, MAX_FREE, VOTE_BONUS, MAX_WITH_VOTE } from "./~data.js";
import { storeButtons, translateFilter } from "./~cmdUtils.js";
import { votedDBL, premiumGuilds } from "../../steam_news/VIPs.js";

import { buttonRow, register } from "../../utils/components.js";
import { ButtonStyle } from "discord.js";
const registerOptions = { singleUse: true, timeout: 900 };

/** @import {Filter,FilterWithSlot} from "./~data.js" */

/** @extends Set<string> */
class Terms extends Set {
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

/**
 * @type {(t: (key:string, arg?:*)=>string, hardMaxReached:boolean)=>string}
 * Get the warning message about a maximum number of filters being reached.
 */
const maxWarning = dbl_url
	? (t, hardMaxReached, action = "at") => (hardMaxReached ? t("at-maximum", MAX_WITH_VOTE) : t(`${action}-maximum-plzvote`))
	: (t, hardMaxReached) => (hardMaxReached ? t("at-maximum", MAX_FREE) : t("at-maximum-plzbuy"));


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
	const hasPremium = premiumGuilds.has(guildId);
	const hasVoted = hasPremium || votedDBL(inter.user.id);
	const { [appid]: existingFilter, length: nFilters, voteFilters, free } = getFilters(guildId, true);

	const slot = existingFilter?.slot ??
		(!free ? "free"
		: hasVoted && voteFilters.length < VOTE_BONUS ? "vote"
		: "premium");
	
	if(existingFilter)
	{
		if(existingFilter.slot === "vote" && !hasVoted)
			return inter.reply({flags: "Ephemeral", content: t("vote-required")});
		if(existingFilter.slot === "premium" && !hasPremium)
			return inter.reply({
				flags: "Ephemeral",
				content: t("premium-required"),
				components: [storeButtons],
			});
	}
	else if(!hasPremium && nFilters >= (hasVoted ? MAX_WITH_VOTE : MAX_FREE))
		return inter.reply({flags: "Ephemeral", content: maxWarning(t, hasVoted)});

	const type = options.getString("type");
	const terms = new Terms(
		options.getString("filter")
		.toLowerCase()
		.split(",")
		.map(string => string.trim()),
		type,
	);
	terms.delete("");

	if(existingFilter)
	{
		handleConflict(inter, existingFilter, terms, { hasPremium, hasVoted, nFilters });
		return;
	}

	const filter = { filter: `${slot}\n${terms}`, appid, guildId };
	const { changes } = setFilter(filter);
	if(changes)
	{
		const hasFiltersLeft = hasPremium || hasVoted && nFilters+1 < MAX_WITH_VOTE;
		inter.reply(filterSetReply(t, filter, hasFiltersLeft, nFilters+1));
	}
	else
		inter.reply({flags: "Ephemeral", content: t("add-failed")});
}


const { Primary: PRIMARY, Success: SUCCESS, Secondary: SECONDARY } = ButtonStyle;
/**
 * Suggest replacing the old filter, merging it with the new, or cancelling the operation.
 * @param {import("discord.js").ChatInputCommandInteraction} inter
 * @param {FilterWithSlot} existingFilter 
 * @param {Terms} newFilter 
 * @param {{ hasPremium:boolean, hasVoted:boolean, nFilters:number }} info
 */
function handleConflict(inter, existingFilter, newFilter, { hasPremium, hasVoted, nFilters })
{
	const t = tr.set(inter.locale, "filter");
	const hasFiltersLeft = hasPremium || hasVoted && nFilters < MAX_WITH_VOTE;
	const nonce = inter.id;
	const REPLACE = `replace-filter-${nonce}`;
	const MERGE = `merge-filters-${nonce}`;
	const CANCEL = `cancel-filter-${nonce}`;
	inter.reply({
		flags: "Ephemeral",
		embeds: [{ description: `${t("conflict")}\n${translateFilter(t, existingFilter)}\n${t("conflict-action")}` }],
		components: [buttonRow(
			{ customId: REPLACE, label: t("conflict-replace"), style: PRIMARY },
			{ customId: MERGE, label: t("conflict-merge"), style: SUCCESS },
			{ customId: CANCEL, label: t("conflict-cancel"), style: SECONDARY },
		)],
	});

	/** @param {import("discord.js").MessageComponentInteraction} inter */
	function updateFilterAndReply(inter) {
		if(setFilter(existingFilter).changes)
		{
			const reply = filterSetReply(t, existingFilter, hasFiltersLeft, nFilters);
			reply.components ??= [];
			inter.update(reply);
		}
		else
			inter.update({content: t("add-failed"), components: []});
	}

	register(REPLACE, inter => {
		existingFilter.filter = `${existingFilter.slot}\n${newFilter}`;
		updateFilterAndReply(inter);
	}, registerOptions);

	register(MERGE, inter => {
		const [slot, line1, line2] = existingFilter.filter.split("\n");
		const lineOfType = line1[0] === newFilter.type ? line1 : line2;
		/** @type {Terms[]} */
		let finalLines;
		if(lineOfType)
		{
			const mergedTermsOfType = new Terms(lineOfType).union(newFilter);
			const otherLine = lineOfType !== line1 ? line1 : line2;
			const filteredOtherTerms = otherLine
				? new Terms(otherLine).difference(newFilter)
				: { size: 0 };
			if(filteredOtherTerms.size)
				finalLines = mergedTermsOfType.type === "+"
					? [mergedTermsOfType, filteredOtherTerms]
					: [filteredOtherTerms, mergedTermsOfType];
			else
				finalLines = [mergedTermsOfType];
		}
		else
		{
			const filteredOldTerms = new Terms(line1).difference(newFilter);
			finalLines = newFilter.type === "+"
				? [newFilter, filteredOldTerms]
				: [filteredOldTerms, newFilter];
		}

		existingFilter.filter = `${slot}\n${finalLines.join("\n")}`;
		updateFilterAndReply(inter);
	}, registerOptions);

	register(CANCEL, () => inter.deleteReply(), registerOptions);
}


/**
 * 
 * @param {(key:string, filter:string) => string} t Translator function, set to "filter"
 * @param {Filter} filter The filter that was just set
 * @param {boolean} hasFiltersLeft Whether the user could still add fitlers afterwards
 * @param {number} nFilters Number of filters after setting that one
 */
function filterSetReply(t, filter, hasFiltersLeft, nFilters)
{
	const reply = `${t("added", filter.name || getAppName(filter.appid))}\n${translateFilter(t, filter)}`;

	if(hasFiltersLeft)
		return { embeds: [{ description: reply }] };
	else
	{
		const callToAction = maxWarning(t, nFilters === (dbl_url ? MAX_WITH_VOTE : MAX_FREE), "reached");
		return {
			embeds: [{ description: `${reply}\n\n-# ${callToAction}` }],
			components: [storeButtons],
		};
	}
}