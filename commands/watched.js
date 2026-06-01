
import { getWatchedApps, getWatchedPrices, getWatchedGroups } from "../steam_news/watchers.js";
import { STEAM_APPID } from "../steam_news/api.js";
import { GAME_COLOR, PRICE_COLOR, STEAM_COLOR, GROUP_COLOR } from "./watch/~commons.js";
import { sendEmbeds } from "../utils/embeds.js";

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter) {
	const t = tr.set(inter.locale, "watched");
	const { guildId } = inter;
	const watched = getWatchedApps(guildId, true);
	const steamWatch = watched.at(-1)?.appid === STEAM_APPID ? watched.pop() : null;
	const watchedPrices = getWatchedPrices(guildId);
	const watchedGroups = getWatchedGroups(guildId);

	const embeds = [
		...toEmbeds(watched, t, "games"),
		...toEmbeds(watchedPrices, t, "prices"),
	];

	if(steamWatch)
	{
		const { webhook, channelId, roleId } = steamWatch;
		const string = webhook ? "steam-watched-webhook" : "steam-watched";
		const role = roleId ? `\n${t("ping")} <@&${roleId}>` : "";
		embeds.push({ color: STEAM_COLOR, description: t(string, `<#${channelId}>`) + role });
	}

	if(watchedGroups.length)
		embeds.push(...toEmbeds(watchedGroups, t, "groups"));

	if(!embeds.length)
		inter.reply({ flags: "Ephemeral", content: t("none") });
	else
		sendEmbeds(embeds, inter, "Ephemeral");
}


const BLOCK_SIZE = 25;
/**
 * Groups watcher data into embeds.
 * @param {(import("../steam_news/db.js").NewsWatcher|import("../steam_news/db.js").PriceWatcher)[]} watched Watcher data
 * @param {function} t A translator function.
 * @param {"games"|"prices"|"groups"} type The embed type.
 * @returns One or more embeds
 */
function toEmbeds(watched, t, type)
{
	if(!watched.length) return [];
	const webhook = watched.some(w => w.webhook);
	watched = watched.map(watcherToField.bind(null, t));
	const embeds = [];
	const color = type === "games" ? GAME_COLOR : type === "prices" ? PRICE_COLOR : GROUP_COLOR;
	for(let i = 0 ; i < watched.length ; i += BLOCK_SIZE)
		embeds.push({ color, fields: watched.slice(i, i + BLOCK_SIZE) });

	Object.assign(embeds[0], {
		title: t.plural(type, watched.length),
	});
	if(webhook)
		embeds.at(-1).footer = { text: `*${t("webhook")}` };
	return embeds;
}

/**
 * Turn a watcher's data info an embed field.
 * @param {(key:string, ...replaces:string[])=>string} t A translator function.
 * @param {import("../steam_news/db.js").NewsWatcher|import("../steam_news/db.js").PriceWatcher|import("../steam_news/db.js").GroupWatcher} watcher The watcher data 
 * @returns {{name:string, value:string, inline:true}} Field data
 */
function watcherToField(t, {nsfw, name, channelId, roleId, webhook}) {
	return {
		name,
		value: `${nsfw ? t("NSFW-yes") : ""}
			${t("channel", `<#${channelId}> ${webhook ? "*" : ""}`)}
			${roleId ? `${t("ping")} <@&${roleId}>` : ""}`
			.trim(),
		inline: true,
	};
}
