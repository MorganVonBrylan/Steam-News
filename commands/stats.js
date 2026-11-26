
import { getStats } from "../steam_news/db_api.js";
import packageFile from "../package.json" with { type: "json" };
const { version } = packageFile;
const msToDays = 3600_000 * 24;
const inline = true;

/** @type {ReturnType<getStats>} */
let stats = null;

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "stats");
	const { user: bot, uptime, ws: { ping } } = inter.client;
	if(!stats)
	{
		stats = getStats();
		setTimeout(() => stats = null, 3600_000);
	}

	inter.reply({embeds: [{
		title: t("title"),
		fields: [
			{ name: t("watchers"), value: ""+stats.watchers, inline },
			{ name: t("games-watched"), value: ""+stats.watchedApps, inline },
			{ name: t("most-watched"), value: `${stats.mostWatchedName}\n-# *(${t("n-watchers", stats.mostWatchedTotal || 0)})*`, inline },

			{ name: t("price-watchers"), value: ""+stats.priceWatchers, inline },
			{ name: t("prices-watched"), value: ""+stats.watchedPrices, inline },
			{ name: t("steam-watchers"), value: ""+stats.steamWatchers, inline },

			{ name: t("group-watchers"), value: ""+stats.groupWatchers, inline },
			{ name: t("group-watched"), value: ""+stats.watchedGroups, inline },
			{ name: t("most-watched-group"), value: `${stats.mostWatchedGroup} \n-# *(${t("n-watchers", stats.mostWatchedGroupTotal || 0)})*`, inline },

			{ name: t("app-filters"), value: ""+stats.appFilters, inline },
			{ name: t("steam-filters"), value: ""+stats.steamFilters, inline },
			{ name: t("group-filter"), value: ""+stats.groupFilters, inline },

			{ name: t("uptime"), value: t("n-days", Math.round(uptime / msToDays)), inline },
			{ name: t("ping"), value: t("ping-ms", Math.round(ping)), inline },
		],
		footer:{
			iconURL: bot.avatarURL(),
			text: `${bot.username} ${version}`,
		},
	}]});
}
