
import { getWatchedApps, getWatchedPrices, getWatchedGroups } from "../steam_news/watchers.js";
import { STEAM_APPID } from "../steam_news/api.js";
import { GAME_COLOR, PRICE_COLOR, STEAM_COLOR, GROUP_COLOR } from "./watch/~commons.js";
import { countFields, MAX_FIELDS_PER_EMBED_NICE_INLINES } from "../utils/embeds.js";
import { translateFilter } from "./filter/~cmdUtils.js";
import paginate from "../utils/paginate.js";

const MAX_FIELDS_PER_EMBED = ~~(MAX_FIELDS_PER_EMBED_NICE_INLINES / 2);

/** @import {NewsWatcher, PriceWatcher, GroupWatcher} from "../steam_news/db.js" */

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter) {
	const t = tr.set(inter.locale, "watched");
	const { guildId } = inter;
	const watched = getWatchedApps(guildId, true);
	const steamWatch = watched.at(-1)?.appid === STEAM_APPID ? watched.pop() : null;
	const watchedPrices = getWatchedPrices(guildId);
	const watchedGroups = getWatchedGroups(guildId);

	const embeds = toSteamEmbed(steamWatch, t).concat(
		toEmbeds(watched, t, "games"),
		toEmbeds(watchedPrices, t, "prices"),
		toEmbeds(watchedGroups, t, "groups"),
	);

	if(!embeds.length)
		inter.reply({ flags: "Ephemeral", content: t("none") });
	else if(countFields(embeds, 1) < 20)
		inter.reply({ flags: "Ephemeral", embeds });
	else
		paginate(inter, { items: embeds, pageLength: 2 }, "Ephemeral");
}

/**
 * Get an array with the Steam watcher embed (or empty if Steam isn't watched)
 * @param {?NewsWatcher} watcher 
 * @param {TransferFunction} t 
 * @returns {[]|[Embed]}
 */
function toSteamEmbed(watcher, t)
{
	if(!watcher) return [];
	const { webhook, channelId, roleId, filter } = watcher;
	const string = webhook ? "steam-watched-webhook" : "steam-watched";
	const lines = [t(string, `<#${channelId}>`)];
	if(roleId) lines.push(`${t("ping")} <@&${roleId}>`);
	if(filter) lines.push(filterLine(t, filter));
	return [{ color: STEAM_COLOR, description: lines.join("\n") }];
}

/**
 * Groups watcher data into embeds.
 * @param {NewsWatcher[]|PriceWatcher[]|GroupWatcher[]} watched Watcher data
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
	for(let i = 0 ; i < watched.length ; i += MAX_FIELDS_PER_EMBED)
		embeds.push({ color, fields: watched.slice(i, i + MAX_FIELDS_PER_EMBED) });

	Object.assign(embeds[0], {
		title: t.plural(type, watched.length),
	});
	if(webhook)
		embeds.at(-1).footer = { text: `*${t("webhook")}` };
	return embeds;
}

/**
 * Turn a watcher's data info an embed field.
 * @param {TranslatorFunction} t A translator function.
 * @param {NewsWatcher|PriceWatcher|GroupWatcher} watcher The watcher data 
 * @returns {{name:string, value:string, inline:true}} Field data
 */
function watcherToField(t, {nsfw, name, channelId, roleId, webhook, filter})
{
	const lines = [];
	if(nsfw) lines.push(t("NSFW-yes"));
	lines.push(t("channel", `<#${channelId}> ${webhook ? "*" : ""}`));
	if(roleId) lines.push(`${t("ping")} <@&${roleId}>`);
	if(filter) lines.push(filterLine(t, filter));

	return { name, value: lines.join("\n"), inline: true };
}


/**
 * Write the line for a filter
 * @param {TranslatorFunction} t
 * @param {import("./filter/~data.js").Filter} filter
 */
function filterLine(t, filter)
{
	const tFilter = t.filter ??= tr.set(t.lang, "filter");
	return `${t("filter")} ${translateFilter(tFilter, {filter})}`;
}