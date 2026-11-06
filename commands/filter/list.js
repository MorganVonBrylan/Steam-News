
import { getFilters } from "../../steam_news/db_api.js";
import { premiumGuilds, votedDBL } from "../../steam_news/VIPs.js";
import { VOTE_BONUS } from "./~data.js";
import { translateFilter, storeButtons } from "./~cmdUtils.js";

const DBL_COLOR = 0x5865F2; // bg color of their logo
const PREMIUM_COLOR = 0xFF8F00; // bg color of the gold plan

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter)
{
	const t = tr.set(inter.locale, "filter");
	const translate = translateFilter.bind(null, t);
	const { free, voteFilters, premiumFilters } = getFilters(inter.guildId, true);

	/** @type {import("discord.js").APIEmbed[]} */
	const embeds = [];
	if(free)
		embeds[0] = {
			title: t("free-filter"),
			description: `${t("for-game", free.name)}\n${translate(free)}`,
		};

	/** @param {import("./~data.js").Filter} filter */
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
	let showStoreButtons = false;
	if(premiumFilters.length)
	{
		showStoreButtons = !hasPremium;
		embeds.push({
			color: PREMIUM_COLOR,
			title: t("premium-filters"),
			description: hasPremium ? `-# ${t("premium-filters-desc")}` : t("premium-filters-disabled"),
			fields: premiumFilters.map(filterToField),
		});
	}
	else if(!hasPremium && free && voteFilters.length >= VOTE_BONUS)
	{
		showStoreButtons = true;
		embeds.push({ description: t("suggest-premium") });
	}

	const components = showStoreButtons ? storeButtons : undefined;
	inter.reply({ flags: "Ephemeral", embeds, components });
}