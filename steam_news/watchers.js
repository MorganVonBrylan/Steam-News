
import {
	query, queryPrices, querySteam,
	getDetails,
	isNSFW,
	STEAM_APPID, STEAM_ICON
} from "./api.js";
import { PermissionFlagsBits as PERMISSIONS } from "discord.js";
const REQUIRED_PERMS = PERMISSIONS.SendMessages | PERMISSIONS.EmbedLinks;
const REQUIRED_THREAD_PERMS = PERMISSIONS.SendMessagesInThreads | PERMISSIONS.EmbedLinks;

async function canWriteIn(channel) {
	return channel?.permissionsFor(await channel.guild.members.fetchMe())
		.has(channel.isThread() ? REQUIRED_THREAD_PERMS : REQUIRED_PERMS);
}

export * from "./db_api.js";
import { purgeApp } from "./db_api.js";
import db, { stmts } from "./db.js";
import { getAppInfo, getWatchedApps, getWatchedPrices, purgeChannel } from "./db_api.js";

import importJSON from "../utils/importJSON.function.js";
import __dirname from "../utils/__dirname.js";
const { WATCH_LIMIT } = importJSON(__dirname(import.meta.url)+"/limits.json");

import { client, sendToMaster } from "../bot.js";
const { channels } = client;


const CHECK_INTERVAL = 3600_000;

function handleDeletedChannel({status, url}) {
    if(status !== 404)
        return;
    const channelId = url.substring(url.lastIndexOf("/")+1);
    purgeChannel(channelId);
}


import toEmbed, { price as toPriceEmbed } from "./toEmbed.function.js";
const openInApps = tr.getAll("info.openInApp");


/**
 * SELECT substr(appid, 1, 1), COUNT(DISTINCT appid)
 * FROM Watchers
 * GROUP BY substr(appid, 1, 1);
 * Stats on 2025-03-15:
 * 1	544
 * 2	505
 * 3	133
 * 4,5,6	58+57+50 = 165
 * 7,8,9	32+39+42 = 113
 */
export const ranges = ["= '1'", "= '2'", "= '3'", "IN ('4', '5', '6')", "IN ('7', '8', '9')"];
const newsRanges = ranges.map(range => {
	const stmt = db.prepare(`SELECT DISTINCT appid FROM Watchers
		WHERE substr(appid, 1, 1) ${range}`).pluck();
	return stmt.all.bind(stmt);
});

let longestTime = 300;
let newsSchedule, pricesSchedule;
export function scheduleChecks() {
	newsSchedule?.forEach(clearInterval);
	clearInterval(pricesSchedule);

	pricesSchedule = setTimeout(checkPrices, CHECK_INTERVAL * 0.8, true);
	const newsCheckInterval = CHECK_INTERVAL * 0.6 / (newsRanges.length - 1);
	checkPrices().then(() => {
		newsSchedule = newsRanges.map((_, i) => 
			setTimeout(checkForNews, newsCheckInterval * i, i, true));
	});
}

function timestamp(rssDate) {
	return new Date(rssDate).getTime() / 1000;
}

/**
 * Triggers all watchers.
 * @param {number} range Index of the range of appids to check (see exported 'ranges').
 * @param {boolean} reschedule Whether to schedule the next check.
 * @returns {Promise<number>} The number of news sent.
 */
export async function checkForNews(range, reschedule = false)
{
	if(reschedule)
		newsSchedule[range] = setTimeout(checkForNews, CHECK_INTERVAL, range, true);

	console.info(new Date(), "Checking news range", ranges[range]);
	const start = Date.now();
	const serverToLang = {};
	for(const { id, lang } of stmts.getAllLocales(false))
		serverToLang[id] = lang;

	let total = 0;

	function getNewsSender(baseEmbeds, query) {
		const nNews = baseEmbeds.length;
		const { footer: { iconUrl } } = baseEmbeds[0];
		const embeds = { english: baseEmbeds };
		const loggedErrors = new Set();

		return ({channelId, roleId}) => channels.fetch(channelId).then(async channel => {
			if(!await canWriteIn(channel))
				return;

			const lang = serverToLang[channel.guild.id] || "english";
			if(!Object.hasOwn(embeds, lang))
			{
				const { appid, newsitems, error } = await query(lang);
				if(error)
				{
					error(`Failed to get ${lang} news for app ${appid}: ${error}`);
					embeds[lang] = embeds.english;
				}
				else
				{
					newsitems.length = nNews;
					const trEmbeds = newsitems.reverse().map(item => toEmbed(item, lang));
					if(iconUrl) for(const embed of trEmbeds)
						embed.footer.iconUrl = iconUrl;
					
					embeds[lang] = trEmbeds;
				}
			}

			for(const embed of embeds[lang])
			{
				channel.send(roleId
					? { content: `<@&${roleId}>`, embeds: [embed] }
					: { embeds: [embed] }
				).then(() => {
					if(embed.yt)
						return channel.send(yt);
				}).catch(err => {
					if(err.status === 403)
						console.error(new Date(), {
							message: "Error sending news: missing access",
							channelId: err.url.match(/channels\/([0-9]+)/)?.[1],
							embeds, targetLang: lang,
						});
					else if(!handleDeletedChannel(err) && !loggedErrors.has(err.message))
					{
						loggedErrors.add(err.message);
						error(Object.assign(err, { embeds, targetLang: lang }));
					}
				});
			}
		})
		.catch(handleDeletedChannel);
	}

	if(range === newsRanges.length - 1)
	{
		const steamWatchers = stmts.getSteamWatchers();
		if(steamWatchers.length)
		{
			querySteam().then(async ({newsitems, error}) => {
				if(error)
					return console.error(`Failed to get news for Steam: ${error}`);

				const { latest } = getAppInfo(STEAM_APPID);
				const news = [];
				for(const newsitem of newsitems)
				{
					if(timestamp(newsitem.date) <= latest)
						break;

					news.push(newsitem);
					if(!latest) break;
				}

				if(!news.length)
					return;

				total += news.length;
				const [{date: latestDate}] = news;
				const baseEmbeds = news.reverse().map(newsitem => {
					const embed = toEmbed(newsitem);
					embed.footer.iconUrl = STEAM_ICON;
					return embed;
				});
				steamWatchers.forEach(getNewsSender(baseEmbeds, querySteam));
				stmts.updateLatest({ appid: STEAM_APPID, latest: timestamp(latestDate) });
			});
		}
	}

	for(const appid of newsRanges[range]())
	{
		const queryNews = query.bind(null, appid);
		const { newsitems, error } = await queryNews();
		if(error)
		{
			console.error(`Failed to get news of app ${appid}: ${error}`);
			if(error === "404 Not Found")
				purgeApp(appid);
			continue;
		}

		const { latest } = getAppInfo(appid);
		const news = [];
		for(const newsitem of newsitems)
		{
			if(timestamp(newsitem.date) <= latest)
				break;

			news.push(newsitem);
			if(!latest) break;
		}

		if(!news.length)
			continue;

		total += news.length;
		const [{date: latestDate}] = news;
		const baseEmbeds = news.reverse().map(newsitem => toEmbed(newsitem));
		stmts.getWatchers(appid).forEach(getNewsSender(baseEmbeds, queryNews));
		stmts.updateLatest({ appid, latest: timestamp(latestDate) });
	};

	const time = ~~((Date.now() - start) / 1000);
	if(time - longestTime > 60)
	{
		const mn = ~~(time / 60);
		const s = time % 60;
		sendToMaster(`checkNews took ${mn}:${s < 10 ? `0${s}` : s} (range ${ranges[range]})`);
		longestTime = time;
	}

	return total;
}


/**
 * Triggers all price watchers.
 * @param {boolean} reschedule Whether to schedule the next check.
 * @returns {Promise<number>} The number of price updates sent.
 */
export async function checkPrices(reschedule = false)
{
	if(reschedule)
		pricesSchedule = setTimeout(checkPrices, CHECK_INTERVAL, true);

	console.info(new Date(), "Checking prices");
	const watchedPrices = {};
	const appsWithUpdatedPrices = [];

	for(const appDetails of stmts.findWatchedPrices())
		watchedPrices[appDetails.appid] = appDetails;

	const priceData = await queryPrices(Object.keys(watchedPrices));
	for(const [appid, {final, discount_percent} = {}] of Object.entries(priceData))
	{
		if(!final) continue; // Sometimes the API call just... fails

		const lastKnownPrice = watchedPrices[appid].lastPrice;
		if(final === lastKnownPrice)
			continue;

		stmts.updateLastPrice({appid, lastPrice: final});
		if(lastKnownPrice === null || final < watchedPrices[appid] || discount_percent)
			appsWithUpdatedPrices.push(appid);
	}

	const newPricesByCC = new Map();
	for(const appid of appsWithUpdatedPrices)
	{
		for(const {channelId, cc} of stmts.getPriceWatchers(appid))
		{
			if(!newPricesByCC.has(cc))
				newPricesByCC.set(cc, new Map());

			const appsForThisCC = newPricesByCC.get(cc);
			if(appsForThisCC.has(appid))
				appsForThisCC.get(appid).push(channelId);
			else
				appsForThisCC.set(appid, [channelId]);
		}
	}

	for(const [cc, appsForThisCC] of newPricesByCC)
	{
		const appDetails = await queryPrices([...appsForThisCC.keys()], cc);
		for(const [appid, price] of Object.entries(appDetails))
		{
			if(!price) continue; // Sometimes the API call just... fails

			price.cc = cc;
			const { name, nsfw } = watchedPrices[appid];
			const embed = { embeds: [toPriceEmbed(appid, name, price)] };
			for(const channelId of appsForThisCC.get(appid))
			{
				await channels.fetch(channelId).then(async channel => {
					if(await canWriteIn(channel) && (!nsfw || channel.nsfw))
						return channel.send(embed);
				})
				.catch(handleDeletedChannel);
			}
		}
	}
}



/**
 * Adds a watcher for an app.
 * A server can only watch 25 apps at once (or 50 if the owner vote on Top.gg).
 * @param {number} appid The app's id.
 * @param {GuildChannel} channel The text-based channel to send the news to.
 * @param {string} roleId The id of the role to ping when posting news/price changes.
 * @param {boolean} price Whether to watch for price changes instead of news. Default: false
 *
 * @returns {Promise<int|boolean|null>} false if that app was already watched in that guild, or the new number of watched apps.
 * Rejects with a TypeError if either parameter is invalid, or with a RangeError if the server reached its LIMIT of apps.
 */
export async function watch(appid, channel, roleId = null, price = false, LIMIT = WATCH_LIMIT)
{
	if(!channel?.isTextBased() || !channel.guildId)
		throw new TypeError("'channel' must be a text-based channel");

	const appnews = await query(appid);
	if(!appnews)
		throw new TypeError("'appid' is not a valid app id");

	const { guildId } = channel;
	const watchedApps = (price ? getWatchedPrices : getWatchedApps)(guildId)
		.map(({ appid }) => appid);

	if(watchedApps.includes(appid))
	{
		stmts[price ? "updatePriceWatcher" : "updateWatcher"]({ appid, guildId, roleId, channelId: channel.id });
		return true;
	}
	
	if(watchedApps.length >= LIMIT)
		throw new RangeError(`This server reached its limit of ${LIMIT} watched ${price ? "prices" : "apps"}.`);

	const wasUnknown = !stmts.isAppKnown(appid);
	if(price || wasUnknown)
	{
		const details = await getDetails(appid);
		if(!details) throw new Error(`Failed to get details of app ${appid}`);

		let knownPrice = null;
		if(wasUnknown)
		{
			stmts.insertApp(appid, details.name,
				+isNSFW(details),
				appnews.newsitems[0]?.date,
				knownPrice = details.is_free ? "free" : details.price_overview?.final,
			);
		}

		if(price)
		{
			const price = details.price_overview;
			if(!knownPrice)
				knownPrice = stmts.getPrice(appid);
			if(knownPrice === "free")
				return null;
			else if(knownPrice === null || !price)
			{
				stmts.updateLastPrice({appid, lastPrice: price?.final});
				return false;
			}

			if(price?.discount_percent && await canWriteIn(channel))
			{
				const cc = price.cc = stmts.getCC(guildId) || "US";
				if(cc === "US")
					channel.send({ embeds: [toPriceEmbed(appid, details.name, price)] }).catch(Function.noop);
				else
					queryPrices(appid, cc)
						.then(prices => channel.send({ embeds: [toPriceEmbed(appid, details.name, prices[appid])] }))
						.catch(Function.noop)
			}
		}
	}

	stmts[price ? "watchPrice" : "watch"]({appid, guildId, channelId: channel.id, roleId});
	return watchedApps.length + 1;
}


/**
 * Stops watching the given app in the given guild.
 * @param {number} appid The app's id.
 * @param {Guild} guild The guild or guild id.
 * @param {boolean} price Whether to unwatch for price changes instead of news. Default: false
 *
 * @returns {int|false} false if that guild was not watching that app, or the new number or apps watched by the guild.
 */
export function unwatch(appid, guild, price = false)
{
	const guildId = guild.id || guild;
	const success = stmts[price ? "unwatchPrice" : "unwatch"](appid, guildId).changes;
	if(!success)
		return false;

	const remaining = (price ? getWatchedPrices : getWatchedApps)(guildId).length;
	if(price && !remaining)
		stmts.updateLastPrice({appid, lastPrice: null});
	return remaining;
}
