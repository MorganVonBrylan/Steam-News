
import { getStats } from "../steam_news/db_api.js";
import importJSON from "../utils/importJSON.function.js";

const { version } = importJSON("package.json");
const msToDays = 3600_000 * 24;

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "stats");
	const { user: bot, uptime, ws: { ping } } = inter.client;
	const stats = getStats();
	const inline = true;

	inter.reply({embeds: [{
		title: "Steam News statistics",
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

			{ name: t("uptime"), value: t("n-days", Math.round(uptime / msToDays)), inline },
			{ name: t("ping"), value: t("ping-ms", ping), inline },
		],
		footer:{
			iconUrl: bot.avatarURL(),
			text: `${bot.username} ${version} — ${t("active-since")}`,
		},
		timestamp: inter.client.application.createdAt.toISOString(),
	}]});
}
