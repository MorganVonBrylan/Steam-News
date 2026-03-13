
import { getWatchedApps, getWatchedPrices } from "../steam_news/watchers.js";
import { stmts } from "../steam_news/db.js";
const { getSteamWatcher } = stmts;

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter) {
	const t = tr.set(inter.locale, "watched");
	const { guild } = inter;
	const watched = getWatchedApps(guild.id);
	const watchedPrices = getWatchedPrices(guild.id);

	const embeds = [
		...toEmbeds(watched, t("games-watched"), tr.plural("games", watched.length)),
		...toEmbeds(watchedPrices, t("prices-watched"), tr.plural("prices", watchedPrices.length)),
	];

	const steamWatch = getSteamWatcher(guild.id);
	if(steamWatch)
	{
		const string = steamWatch.webhook ? "steam-watched-webhook" : "steam-watched";
		embeds.push({ description: t(string, `<#${steamWatch.channelId}>`) });
	}

	if(!embeds.length)
		inter.reply({ flags: "Ephemeral", content: t("none") });
	else
	{
		inter.reply({ flags: "Ephemeral", embeds: embeds.slice(0, 10) }).then(() => {
			for(let i = 10 ; i < embeds.length ; i += 10)
				inter.followUp({ flags: "Ephemeral", embeds: embeds.slice(i, i+10) });
		});
	}
}


/**
 * Groups watcher data into embeds.
 * @param {(import("../steam_news/db.js").NewsWatcher|import("../steam_news/db.js").PriceWatcher)[]} watched Watcher data
 * @param {string} title The title of the embeds. Will only be given to the first one.
 * @param {string} description The description of the wembeds. Will only be given to the first one.
 * @param {number} blockSize How many fields per embed (default and maximum: 25)
 * @returns One or more embeds
 */
function toEmbeds(watched, title, description, blockSize = 25)
{
	if(!watched.length) return [];
	watched = watched.map(watcherToField);
	const embeds = [];
	for(let i = 0 ; i < watched.length ; i += blockSize)
		embeds.push({fields: watched.slice(i, i + blockSize)});

	Object.assign(embeds[0], { title, description });
	return embeds;
}

/**
 * Turn a watcher's data info an embed field.
 * @param {import("../steam_news/db.js").NewsWatcher|import("../steam_news/db.js").PriceWatcher} watcher The watcher data 
 * @returns {{name:string, value:string, inline:true}} Field data
 */
function watcherToField({appid, nsfw, name, channelId, roleId, webhook}) {
	webhook = webhook ? ` ${tr.t("webhook")}` : "";
	return {
		name,
		value: `${tr.t("id", appid)}
			${tr.t(`NSFW-${nsfw ? "yes" : "no"}`)}
			${tr.t("channel", `<#${channelId}>${webhook}`)}
			${tr.t("ping")} ${roleId ? `<@&${roleId}>` : `*${tr.t("no-ping")}*`}`,
		inline: true,
	};
}
