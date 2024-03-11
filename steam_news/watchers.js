
import {
	query, queryPrices, querySteam,
	getDetails,
	isNSFW,
	STEAM_APPID, STEAM_ICON
} from "./api.js";
import { PermissionFlagsBits as PERMISSIONS } from "discord.js";
const REQUIRED_PERMS = PERMISSIONS.SendMessages | PERMISSIONS.EmbedLinks;

async function canWriteIn(channel) {
	return channel?.permissionsFor(await channel.guild.members.fetchMe()).has(REQUIRED_PERMS);
}

import db, { stmts } from "./db.js";

import importJSON from "../importJSON.function.js";
import __dirname from "../__dirname.js";
const { WATCH_LIMIT } = importJSON(__dirname(import.meta.url)+"/limits.json");
const { countryToLang } = importJSON("locales.json");

import { client, sendToMaster } from "../bot.js";
const { channels } = client;
client.once("ready", checkForNews);
client.once("ready", checkPrices);


const CHECK_INTERVAL = 3600_000;


/**
 * @param {number} appid The app's id
 * @returns {boolean} Whether the app is known by the bot or not.
 */
export const isKnown = appid => !!stmts.isAppKnown(appid);

/**
 * @param {number} appid The app's id
 * @returns {?object} The app info (name, NSFW status and latest news timestamp), if known.
 */
export const getAppInfo = stmts.getAppInfo;

/**
 * Stores or updates the given app info.
 * @param {number} appid The app's id.
 * @param {object} details The relevant details (all optional except the name)
 	* @param {string} details.name The app's name
 	* @param {boolean} details.nsfw Whether the app is NSFW or not.
	* @param {string} details.latest That app's latest news' timestamp.
 */
export function saveAppInfo(appid, details)
{
	const fields = ["name", "nsfw", "latest"].filter(field => field in details);
	details.appid = appid;

	if(stmts.isAppKnown(appid))
		db.run(`UPDATE Apps SET ${fields.map(f => `${f} = $${f}`).join()} WHERE appid = $appid`, details);
	else
	{
		fields.push("appid");
		db.run(`INSERT INTO Apps (${fields.join()}) VALUES (${fields.map(f => "$"+f).join()})`, details);
	}
};

/**
 * @param {number} appid The app's id
 * @returns {?string} The app's name, if known.
 */
export const getAppName = stmts.getAppName;
/**
 * @param {number} appid The app's id
 * @returns {?bool} Whether is app is NSFW, if known.
 */
const { isAppNSFW } = stmts;
export { isAppNSFW as isNSFW };

/**
 * @param {string} guildId The guild id
 * @returns {Array} The apps watched in that guild, in the format {appid, name, nsfw, channelId}
 */
export const getWatchedApps = stmts.getWatchedApps;

/**
 * @param {string} guildId The guild id
 * @returns {Array} The app prices watched in that guild, in the format {appid, name, nsfw, lastPrice, channelId}
 */
export const getWatchedPrices = stmts.getWatchedPrices;


setInterval(checkForNews, CHECK_INTERVAL);
setInterval(checkPrices, CHECK_INTERVAL * 3);

import toEmbed, { price as toPriceEmbed } from "./toEmbed.function.js";
const openInApps = tr.getAll("info.openInApp");

let longestTime = 300;

/**
 * Triggers all watchers.
 * @returns {Promise<number>} The number of news sent.
 */
export async function checkForNews()
{
	const start = Date.now();
	const serverToLang = {};
	for(const {id, cc} of stmts.getAllCC(false))
		serverToLang[id] = countryToLang[cc];
	let total = 0;

	function getEmbedSender(baseEmbed) {
		const {yt} = baseEmbed;
		const embeds = { en: { embeds: [baseEmbed] } };
		let loggedError = false;

		return ({channelId, roleId}) => channels.fetch(channelId).then(async channel => {
			if(!await canWriteIn(channel))
				return;

			const lang = serverToLang[channel.guild.id] || "en";
			if(!(lang in embeds))
			{
				const openInApp = openInApps[lang];
				if(openInApp)
				{
					const trEmbed = {...baseEmbed};
					trEmbed.fields[0].name = openInApps[lang];
					embeds[lang] = { embeds: [trEmbed] };
				}
				else
					embeds[lang] = embeds.en;
			}

			const message = roleId
				? { ...embeds[lang], content: `<@&${roleId}>` }
				: embeds[lang];
			channel.send(message).catch(loggedError ? Function() : (err) => {
				loggedError = true;
				error(Object.assign(err, { embeds, targetLang: lang }));
			});
			if(yt)
				channel.send(yt).catch(Function());
		}, Function());
	}

	const steamWatchers = stmts.getSteamWatchers();
	if(steamWatchers.length)
	{
		querySteam(5).then(async ({appnews}) => {
			if(!appnews)
				return console.error(`Failed to get news for Steam`);

			const { latest } = stmts.getAppInfo(STEAM_APPID);
			const news = [];
			for(const newsitem of appnews.newsitems)
			{
				if(newsitem.date <= latest)
					break;

				news.push(newsitem);
				if(!latest) break;
			}

			if(!news.length)
				return;

			const [{date: latestDate}] = news;
			for(const newsitem of news.reverse())
			{
				const baseEmbed = await toEmbed(newsitem);
				baseEmbed.footer.iconUrl = STEAM_ICON;
				steamWatchers.forEach(getEmbedSender(baseEmbed));
			}
			stmts.updateLatest({ appid: STEAM_APPID, latest: latestDate });
		});
	}

	await Promise.allSettled(stmts.findWatchedApps().map(appid => query(appid, 5).then(async ({appnews}) => {
		if(!appnews)
			return console.error(`Failed to get news of app ${id}`);

		const { latest } = stmts.getAppInfo(appid);
		const news = [];
		for(const newsitem of appnews.newsitems)
		{
			if(newsitem.date === latest)
				break;

			news.push(newsitem);
			if(!latest) break;
		}

		if(!news.length)
			return;

		const [{date: latestDate}] = news;
		total += news.length;
		for(const newsitem of news.reverse())
			stmts.getWatchers(appid).forEach(getEmbedSender(await toEmbed(newsitem)));

		stmts.updateLatest({ appid, latest: latestDate });
	})));


	const time = ~~((Date.now() - start) / 1000);
	if(time - longestTime > 60)
	{
		const mn = ~~(time / 60);
		const s = time % 60;
		sendToMaster(`checkNews took ${mn}:${s < 10 ? `0${s}` : s}`);
		longestTime = time;
	}

	return total;
}


/**
 * Triggers all price watchers.
 * @returns {Promise<number>} The number of price updates sent.
 */
export async function checkPrices()
{
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
				const channel = await channels.fetch(channelId).catch(Function());
				if(await canWriteIn(channel) && (!nsfw || channel.nsfw))
					channel.send(embed).catch(Function());
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
	if(!channel?.isTextBased() || !channel.guild)
		throw new TypeError("'channel' must be a text-based channel");

	const {appnews} = await query(appid);
	if(!appnews)
		throw new TypeError("'appid' is not a valid app id");

	const guildId = channel.guild.id;
	const watchedApps = stmts[price ? "getWatchedPrices" : "getWatchedApps"](guildId)
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
					channel.send({ embeds: [toPriceEmbed(appid, details.name, price)] }).catch(Function());
				else
					queryPrices(appid, cc)
						.then(prices => channel.send({ embeds: [toPriceEmbed(appid, details.name, prices[appid])] }))
						.catch(Function())
			}
		}
	}

	stmts[price ? "watchPrice" : "watch"]({appid, guildId, channelId: channel.id, roleId});
	return watchedApps.length + 1;
}



/**
 * Stops watching the given app in the given guild.
 * @param {number} appid The app's id.
 * @param {Guild} guild The guild.
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

	const remaining = stmts[price ? "getWatchedPrices" : "getWatchedApps"](guildId).length;
	if(price && !remaining)
		stmts.updateLastPrice({appid, lastPrice: null});
	return remaining;
}


/**
 * Removes all watchers of a guild.
 * @param {string} guildId The guild or guild id.
 * @returns {boolean} true if the server was purged, false if there was nothing to purge.
 */
export const purgeGuild = guildId => !!stmts.purgeGuild(guildId.id || guildId).changes;

/**
 * Removes all watchers of a channel.
 * @param {string} channelId The channel or channel id.
 * @returns {boolean} true if the channel was purged, false if there was nothing to purge.
 */
export const purgeChannel = channelId => !!stmts.purgeChannel(channelId.id || channelId).changes;


/**
 * Removes all watchers of an app.
 * @param {number} appid The app's id.
 * @returns {boolean} true if the app was purged, false if there was nothing to purge.
 */
export const purgeApp = appid => !!db.run("DELETE FROM Watchers WHERE appid = ?", appid).changes;
// Not prepared because it is only used in debug mode
