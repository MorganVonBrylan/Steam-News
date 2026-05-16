
import { getWatchedApps, getWatchedPrices } from "../steam_news/watchers.js";
import { STEAM_APPID } from "../steam_news/api.js";
import { sendEmbeds } from "../utils/embeds.js";

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter) {
	const t = tr.set(inter.locale, "watched");
	const { guildId } = inter;
	const watched = getWatchedApps(guildId, true);
	const steamWatch = watched.at(-1)?.appid === STEAM_APPID ? watched.pop() : null;
	const watchedPrices = getWatchedPrices(guildId);

	const embeds = [
		...toEmbeds(watched, t, "games"),
		...toEmbeds(watchedPrices, t, "prices"),
	];

	if(steamWatch)
	{
		const string = steamWatch.webhook ? "steam-watched-webhook" : "steam-watched";
		embeds.push({ description: t(string, `<#${steamWatch.channelId}>`) });
	}

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
 * @param {"games"|"prices"} type The embed type.
 * @returns One or more embeds
 */
function toEmbeds(watched, t, type)
{
	if(!watched.length) return [];
	watched = watched.map(watcherToField.bind(null, t));
	const embeds = [];
	for(let i = 0 ; i < watched.length ; i += BLOCK_SIZE)
		embeds.push({fields: watched.slice(i, i + BLOCK_SIZE)});

	Object.assign(embeds[0], {
		title: t(`${type}-watched`),
		description: t.plural(type, watched.length),
	});
	return embeds;
}

/**
 * Turn a watcher's data info an embed field.
 * @param {(key:string, ...replaces:string[])=>string} t A translator function.
 * @param {import("../steam_news/db.js").NewsWatcher|import("../steam_news/db.js").PriceWatcher} watcher The watcher data 
 * @returns {{name:string, value:string, inline:true}} Field data
 */
function watcherToField(t, {nsfw, name, channelId, roleId, webhook}) {
	return {
		name,
		value: `${nsfw ? t("NSFW-yes") : ""}
			${t("channel", `<#${channelId}> ${webhook ? t("webhook") : ""}`)}
			${roleId ? `${t("ping")} <@&${roleId}>` : ""}}`
			.trim(),
		inline: true,
	};
}
