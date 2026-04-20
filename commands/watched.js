
import { getWatchedApps, getWatchedPrices } from "../steam_news/watchers.js";
import { STEAM_APPID } from "../steam_news/api.js";
import { sendEmbeds } from "../utils/embeds.js";

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter) {
	const t = tr.set(inter.locale, "watched");
	const { guild } = inter;
	const watched = getWatchedApps(guild.id, true);
	const steamWatch = watched.at(-1)?.appid === STEAM_APPID ? watched.pop() : null;
	const watchedPrices = getWatchedPrices(guild.id);

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


/**
 * Groups watcher data into embeds.
 * @param {(import("../steam_news/db.js").NewsWatcher|import("../steam_news/db.js").PriceWatcher)[]} watched Watcher data
 * @param {function} t A translator function.
 * @param {"games"|"prices"} type The embed type.
 * @param {number} blockSize How many fields per embed (default and maximum: 25)
 * @returns One or more embeds
 */
function toEmbeds(watched, t, type, blockSize = 25)
{
	if(!watched.length) return [];
	watched = watched.map(watcherToField.bind(null, t));
	const embeds = [];
	for(let i = 0 ; i < watched.length ; i += blockSize)
		embeds.push({fields: watched.slice(i, i + blockSize)});

	Object.assign(embeds[0], {
		title: t(`${type}-watched`),
		description: t.plural(type, watched.length),
	});
	return embeds;
}

/**
 * Turn a watcher's data info an embed field.
 * @param {function} t A translator function.
 * @param {import("../steam_news/db.js").NewsWatcher|import("../steam_news/db.js").PriceWatcher} watcher The watcher data 
 * @returns {{name:string, value:string, inline:true}} Field data
 */
function watcherToField(t, {appid, nsfw, name, channelId, roleId, webhook}) {
	webhook = webhook ? ` ${t("webhook")}` : "";
	return {
		name,
		value: `${t("id", appid)}
			${t(`NSFW-${nsfw ? "yes" : "no"}`)}
			${t("channel", `<#${channelId}>${webhook}`)}
			${t("ping")} ${roleId ? `<@&${roleId}>` : `*${t("no-ping")}*`}`,
		inline: true,
	};
}
