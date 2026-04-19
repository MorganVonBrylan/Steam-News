
import {
	query, queryPrices, querySteam,
	getDetails,
	isNSFW,
	STEAM_APPID
} from "./api.js";
import { REQUIRED_PERMS, REQUIRED_THREAD_PERMS } from "../utils/embeds.js";

/**
 * Check if the bot can send message to a channel.
 * @param {?Webhook|import("../utils/channels.js").GuildTextChannel} channel 
 * @returns {Promise<boolean>}
 */
async function canWriteIn(channel) {
	return channel instanceof Webhook
		|| channel?.permissionsFor(await channel.guild.members.fetchMe())
		.has(channel.isThread() ? REQUIRED_THREAD_PERMS : REQUIRED_PERMS);
}

export * from "./db_api.js";

import { purgeApp } from "./db_api.js";
import db, { stmts } from "./db.js";
import { getAppInfo, getWatchedApps, getWatchedPrices, purgeChannel } from "./db_api.js";

import { WATCH_LIMIT, WATCH_VOTE_BONUS } from "./limits.js";
import { premiumGuilds, chameleonGuilds } from "./VIPs.js";
import { Webhook } from "../commands/premium/chameleon/~webhook.js";

import { client, sendToMaster } from "../bot.js";
const { channels } = client;


const CHECK_INTERVAL = 3600_000;

function logQueryError(message, httpStatus)
{
	if(httpStatus[0] !== "5")
		console.error(new Date(), `${message}: ${httpStatus}`);
}

/**
 * Purge a channel from the database if trying to send in it ended in a 404 error.
 * @param {Error} error The Error received when trying to send news/prices.
 * @returns {boolean} true if the error was handled, false if it wasn't a 404
 */
function handleDeletedChannel({status, url}) {
    if(status !== 404)
        return;
    const channelId = url.substring(url.lastIndexOf("/")+1);
    purgeChannel(channelId);
	return true;
}

/**
 * If trying to post to a webhook ended with a 4** error, purge it from the database and try sending the news again to the channel.
 * @param {Error} err The Error received when trying to send news/prices.
 * @param {Webhook} webhook The webhook object
 * @param {object} watcher The watcher info
 * @param {(watcher:object)=>*} sendNews The sendNews function, to try again with the channel
 * @returns {boolean} true if the error was handled, false if it wasn't a 4**
 */
function handleDeletedWebhook(err, {webhookPurged}, watcher, sendNews) {
	if(webhookPurged)
	{
		watcher.webhook = null;
		sendNews(watcher);
		return true;
	}
	error(err);
	return false;
}


import toEmbed, { price as toPriceEmbed } from "./toEmbed.function.js";


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
 * Make news embeds and order them in ascending chronological order.
 * @param {object[]} news The news items in descending chronological order (as returned by the API)
 * @param  {string} language The language 
 * @returns The news embeds
 */
function newsToEmbeds(news, language) {
	return Promise.all(news.reverse().map(item => toEmbed(item, language)));
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
		newsSchedule[range] = setTimeout(checkForNews, CHECK_INTERVAL, range, reschedule);

	console.info(new Date(), "Checking news range", ranges[range]);
	const start = Date.now();
	const serverToLang = {};
	for(const { id, lang } of stmts.getAllLocales(false))
		serverToLang[id] = lang;

	let attempts = 0, successes = 0;
	let total = 0;

	/**
	 * @param {object[]} baseEmbeds The news embeds in the default language
	 * @param {(lang:string)=>ReturnType<query>} query The query function bound to an appid
	 */
	function getNewsSender(baseEmbeds, query) {
		const nNews = baseEmbeds.length;
		const { footer: { iconUrl } } = baseEmbeds[0];
		const embeds = { english: baseEmbeds };
		const loggedErrors = new Set();

		return sendNews;
		function sendNews(watcher) {
			const { guildId, channelId, roleId } = watcher;
			return (
			watcher.webhook && chameleonGuilds.has(guildId)
			? Promise.resolve(new Webhook(watcher.webhook, channelId))
			: channels.fetch(channelId)
		).then(async channel => {
			if(channel.locked)
				return purgeChannel(channelId);

			attempts++;
			if(!await canWriteIn(channel))
				return;

			const lang = serverToLang[guildId] || "english";
			if(!Object.hasOwn(embeds, lang))
			{
				const { appid, newsitems, error: err } = await query(lang);
				if(err)
				{
					logQueryError(`Failed to get ${lang} news for app ${appid}`, err);
					embeds[lang] = embeds.english;
				}
				else
				{
					newsitems.length = nNews;
					const trEmbeds = await newsToEmbeds(newsitems, lang);
					if(iconUrl) for(const embed of trEmbeds)
						embed.footer.iconUrl = iconUrl;
					
					embeds[lang] = trEmbeds;
				}
			}

			return Promise.allSettled(embeds[lang].map(embed => {
				return channel.send(roleId
					? { content: `<@&${roleId}>`, embeds: [embed] }
					: { embeds: [embed] }
				).then(embed.yt ? () => channel.send(embed.yt) : Function.noop)
				.then(() => successes++)
				.catch(err => {
					if(err.status === 403)
						console.error(new Date(), {
							message: "Error sending news: missing access",
							channelId: err.url.match(/channels\/([0-9]+)/)?.[1],
							embeds, targetLang: lang,
						});
					else if((channel instanceof Webhook
						? !handleDeletedWebhook(err, channel, watcher, sendNews)
						: !handleDeletedChannel(err))
						&& !loggedErrors.has(err.message))
					{
						loggedErrors.add(err.message);
						error(Object.assign(err, { embeds, targetLang: lang }));
					}
				});
			}));
		})
		.catch(handleDeletedChannel)};
	}

	let promises = [];

	if(range === newsRanges.length - 1)
	{
		querySteam().then(async ({newsitems, error: err}) => {
			if(err)
				return logQueryError("Failed to get news for Steam", err);

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

			const steamWatchers = stmts.getSteamWatchers();
			if(!steamWatchers.length)
				return;

			total += news.length;
			const [{date: latestDate}] = news;
			const baseEmbeds = await newsToEmbeds(news);
			promises.push(...steamWatchers.map(getNewsSender(baseEmbeds, querySteam)));
			stmts.updateLatest({ appid: STEAM_APPID, latest: timestamp(latestDate) });
		});
	}

	for(const appid of newsRanges[range]())
	{
		const queryNews = query.bind(null, appid);
		const { newsitems, error: err } = await queryNews();
		if(err)
		{
			logQueryError(`Failed to get news of app ${appid}`, err);
			if(err.startsWith("404"))
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
		const baseEmbeds = await newsToEmbeds(news);

		const watchers = stmts.getWatchers(appid)
			.filter(({premium, guildId}) => !premium || premiumGuilds.has(guildId));
		promises.push(...watchers.map(getNewsSender(baseEmbeds, queryNews)));

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

	if(promises.length)
		Promise.allSettled(promises).then(() => console.info(new Date(), "Successfully sent", successes, "/", attempts));

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
		pricesSchedule = setTimeout(checkPrices, CHECK_INTERVAL, reschedule);

	console.info(new Date(), "Checking prices");
	const watchedPrices = {};
	for(const appDetails of stmts.findWatchedPrices())
		watchedPrices[appDetails.appid] = appDetails;

	const appsWithUpdatedPrices = await updatePriceDatabase(watchedPrices);

	const newPricesByCC = new Map();
	for(const appid of appsWithUpdatedPrices)
	{
		for(const {channelId, webhook, cc} of stmts.getPriceWatchers(appid))
		{
			const sender = webhook
				? new Webhook(webhook, channelId)
				: await channels.fetch(channelId).catch(handleDeletedChannel)
			
			if(typeof sender !== "object")
				continue;

			if(!newPricesByCC.has(cc))
				newPricesByCC.set(cc, new Map());

			const appsForThisCC = newPricesByCC.get(cc);
			const appWatchers = appsForThisCC.get(appid);
			if(appWatchers)
				appWatchers.push(sender);
			else
				appsForThisCC.set(appid, [sender]);
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
			const embed = { embeds: [await toPriceEmbed(appid, name, price)] };
			for(const sender of appsForThisCC.get(appid))
			{
				if(sender instanceof Webhook)
				{
					sender.send(embed).catch(err => handleDeletedWebhook(
						err, sender, {},
						() => channels.fetch(sender.channelId)
							.then(channel => postToChannel(channel, embed, nsfw),
							handleDeletedChannel),
					));
				}
				else
					postToChannel(sender, embed, nsfw);
			}
		}
	}
}

async function updatePriceDatabase(watchedPrices)
{
	const appsWithUpdatedPrices = [];
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
	return appsWithUpdatedPrices;
}

/**
 * Send a message to a provided channel. Checks for permissions and nsfw status beforehand.
 * @param {import("../utils/channels.js").GuildTextChannel} channel 
 * @param {string|object} message Message data
 * @param {boolean} nsfw Whether the message is NSFW
 * @returns {Promise<?import("discord.js").Message>} The message, or undefined the permissions are missing or the message is NSFW but the channel isn't.
 */
async function postToChannel(channel, message, nsfw)
{
	return await canWriteIn(channel) && (!nsfw || channel.nsfw)
		? channel.send(message)
		: null;
}



/**
 * Adds a watcher for an app.
 * A server can only watch 25 apps at once (or 50 if the owner vote on Top.gg).
 * @param {number} appid The app's id.
 * @param {GuildChannel} channel The text-based channel to send the news to.
 * @param {string} roleId The id of the role to ping when posting news/price changes.
 * @param {boolean} price Whether to watch for price changes instead of news. Default: false
 *
 * @returns {Promise<int|object|false|null>} false if that app was already watched in that guild, null if it's a price watch and the game is free, the old watcher data if the watcher existed and was updated, or the new number of watched apps if it was added.
 * @throws {TypeError} if either parameter is invalid
 * @throws {RangeError} if the server reached its LIMIT of apps
 */
export async function watch(appid, channel, roleId = null, price = false, LIMIT = WATCH_LIMIT)
{
	if(!channel?.isTextBased() || !channel.guildId)
		throw new TypeError("'channel' must be a text-based channel");

	const appnews = await query(appid);
	if(!appnews)
		throw new TypeError("'appid' is not a valid app id");

	const { guildId } = channel;
	const watchedApps = (price ? getWatchedPrices : getWatchedApps)(guildId);
	const watcher = watchedApps.find(w => w.appid === appid);
	if(watcher)
	{
		const stmt = stmts[price ? "updatePriceWatcher" : "updateWatcher"];
		stmt({ ...watcher, roleId, channelId: channel.id });
		return watcher;
	}
	
	if(watchedApps.length >= LIMIT)
		throw new RangeError(`This server reached its limit of ${LIMIT} watched ${price ? "prices" : "apps"}.`);

	// + because SQLite fails if you give it a boolean
	const premium = +(watchedApps.length >= WATCH_LIMIT+WATCH_VOTE_BONUS);

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
				timestamp(appnews.newsitems[0]?.date),
				knownPrice = details.is_free ? "free" : details.price_overview?.final,
			);
		}

		if(price)
		{
			const price = details.price_overview;
			if(!knownPrice)
				knownPrice = stmts.getPrice(appid);
			if(knownPrice === "free")
			{
				if(details.is_free)
					return null;
				else if(price)
					stmts.updateLastPrice({appid, lastPrice: price.final});
			}
			
			if(knownPrice === null || !price)
			{
				stmts.updateLastPrice({appid, lastPrice: price?.final});
				return false;
			}

			if(price?.discount_percent && await canWriteIn(channel))
			{
				const cc = price.cc = stmts.getCC(guildId) || "US";
				if(cc === "US")
				{
					channel.send({ embeds: [await toPriceEmbed(appid, details.name, price)] })
						.catch(Function.noop);
				}
				else
				{
					queryPrices(appid, cc)
						.then(prices => toPriceEmbed(appid, details.name, prices[appid]))
						.then(embed => channel.send({ embeds: [embed] }))
						.catch(Function.noop)
				}
			}
		}
	}

	stmts[price ? "watchPrice" : "watch"]({appid, guildId, channelId: channel.id, roleId, premium});
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
