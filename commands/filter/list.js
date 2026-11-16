
import { getFilters } from "../../steam_news/db_api.js";
import { premiumGuilds, votedDBL } from "../../steam_news/VIPs.js";
import { VOTE_BONUS } from "./~data.js";
import { translateFilter, storeButtons } from "./~cmdUtils.js";
import paginate from "../../utils/paginate.js";
import { MAX_FIELDS_PER_EMBED_NICE_INLINES as MAX_FIELDS_PER_EMBED } from "../../utils/embeds.js";

/** @import {Filter} from "./~data.js" */

const DBL_COLOR = 0x5865F2; // bg color of their logo
const PREMIUM_COLOR = 0xFF8F00; // bg color of the gold plan

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter)
{
	const t = tr.set(inter.locale, "filter");
	const translate = translateFilter.bind(null, t);
	const { free, voteFilters, premiumFilters } = getFilters(inter.guildId, true);

	/** @type {import("discord.js").Embed[]} */
	const embeds = [];
	if(free)
		embeds[0] = {
			title: t("free-filter"),
			description: `${t("for-game", free.name)}\n${translate(free)}`,
		};

	/** @param {Filter} filter */
	const filterToField = ({name, filter}) => ({ name, value: translate({filter}), inline: true });

	if(voteFilters.length)
	{
		embeds.push({
			color: DBL_COLOR,
			title: t("vote-filters", { number: voteFilters.length, max: VOTE_BONUS }),
			description: votedDBL(inter.user.id) ? undefined : `-# ${t("vote-filters-desc")}`,
			fields: voteFilters.map(filterToField),
		});
	}
	else if(votedDBL(inter.user.id))
	{
		embeds.push({
			color: DBL_COLOR,
			title: t("vote-filters", { number: 0, max: VOTE_BONUS }),
			description: t("vote-filters-none"),
		});
	}

	const hasPremium = premiumGuilds.has(inter.guildId);
	const premiumEmbeds = premiumFilterEmbeds(t, filterToField, hasPremium, premiumFilters);
	let showStoreButtons = false;
	if(premiumFilters.length)
		showStoreButtons = !hasPremium;
	else if(!hasPremium && free && voteFilters.length >= VOTE_BONUS)
	{
		showStoreButtons = true;
		embeds.push({ description: t("suggest-premium") });
	}

	const components = showStoreButtons ? storeButtons : undefined;
	if(premiumEmbeds.length <= 1)
	{
		embeds.push(...premiumEmbeds);
		inter.reply({ flags: "Ephemeral", embeds, components });
	}
	else
	{
		paginate(inter, {
			items: premiumEmbeds,
			pageLength: 1,
			renderer: ([embed]) => embeds.concat(embed),
		}, "Ephemeral");
	}
}


/**
 * @param {(key:string, replaces:string|object)=>string} t Translator function
 * @param {(filer:Filter)=>({name:string, value:string, inline:true})} filterToField
 * @param {boolean} hasPremium 
 * @param {Filter[]} premiumFilters 
 * @return {import("discord.js").Embed[]}
 */
function premiumFilterEmbeds(t, filterToField, hasPremium, premiumFilters)
{
	const { length } = premiumFilters;
	if(!length)
		return [];
	if(!hasPremium)
	{
		const plzBuySub = t("premium-filters-plzBuy");
		const tooMany = length > MAX_FIELDS_PER_EMBED;
		return [{
			color: PREMIUM_COLOR,
			title: t("premium-filters"),
			description: t("premium-filters-disabled"),
			fields: tooMany
				? premiumFilters.slice(0, MAX_FIELDS_PER_EMBED).map(filterToField)
				: premiumFilters.map(filterToField),
			footer: {
				text: length <= MAX_FIELDS_PER_EMBED
					? plzBuySub
					: `${t("more-filters-to-show", length - MAX_FIELDS_PER_EMBED)}\n${plzBuySub}`
			},
		}];
	}
	
	const fields = premiumFilters.map(filterToField);
	if(length <= MAX_FIELDS_PER_EMBED)
	{
		return [{
			color: PREMIUM_COLOR,
			title: t("premium-filters"),
			description: `-# ${t("premium-filters-desc")}`,
			fields,
		}];
	}
	else
	{
		const nPages = Math.ceil(length / MAX_FIELDS_PER_EMBED);
		const premiumEmbeds = [];
		for(let i = 0 ; i < length ; i += MAX_FIELDS_PER_EMBED)
		{
			const page = 1 + i / MAX_FIELDS_PER_EMBED;
			premiumEmbeds.push({
				color: PREMIUM_COLOR,
				title: t("premium-filters-page", { page, nPages }),
				description: `-# ${t("premium-filters-desc")}`,
				fields: fields.slice(i, i + MAX_FIELDS_PER_EMBED),
			});
		}
		return premiumEmbeds;
	}
}