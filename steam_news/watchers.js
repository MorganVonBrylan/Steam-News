"use strict";

const { existsSync, promises: {readFile, writeFile, unlink} } = require("fs");
const { query, queryPrices, querySteam, getDetails, isNSFW, STEAM_APPID, STEAM_ICON } = require("./api");
const { SendMessages, EmbedLinks } = require("discord.js").PermissionsBitField.Flags;
const REQUIRED_PERMS = SendMessages | EmbedLinks;

const watchFile = __dirname + "/watchers.json";
const {WATCH_LIMIT} = require("./limits");
Object.freeze(require("./limits"));

const db = require("./db");
const { stmts } = db;

const { countryToLang } = require("../locales.json");

require("../bot").client.once("ready", checkForNews);
require("../bot").client.once("ready", checkPrices);


const CHECK_INTERVAL = 3600_000;


/**
 * @param {int} appid The app's id
 * @returns {bool} Whether the app is known by the bot or not.
 */
exports.isKnown = appid => !!stmts.isAppKnown(appid);

/**
 * @param {int} appid The app's id
 * @returns {?object} The app info (name, NSFW status and latest news timestamp), if known.
 */
exports.getAppInfo = stmts.getAppInfo;

/**
 * Stores or updates the given app info.
 * @param {int} appid The app's id.
 * @param {object} details The relevant details (all optional except the name)
 	* @param {string} details.name The app's name
 	* @param {bool} details.nsfw Whether the app is NSFW or not.
	* @param {string} details.latest That app's latest news' timestamp.
 */
exports.saveAppInfo = (appid, details) => {
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
 * @param {int} appid The app's id
 * @returns {?string} The app's name, if known.
 */
exports.getAppName = stmts.getAppName;
/**
 * @param {int} appid The app's id
 * @returns {?bool} Whether is app is NSFW, if known.
 */
exports.isNSFW = stmts.isAppNSFW;

/**
 * @param {string} guildId The guild id
 * @returns {Array} The apps watched in that guild, in the format {appid, name, nsfw, channelId}
 */
exports.getWatchedApps = stmts.getWatchedApps;

/**
 * @param {string} guildId The guild id
 * @returns {Array} The app prices watched in that guild, in the format {appid, name, nsfw, lastPrice, channelId}
 */
exports.getWatchedPrices = stmts.getWatchedPrices;


setInterval(checkForNews, CHECK_INTERVAL);
setInterval(checkPrices, CHECK_INTERVAL * 3);

const toEmbed = require("./toEmbed.function");
const openInApps = tr.getAll("info.openInApp");

/**
 * Triggers all watchers.
 * @returns {Promise<int>} The number of news sent.
 */
exports.checkForNews = checkForNews;
async function checkForNews()
{
	const { channels } = require("../bot").client;
	const serverToLang = {};
	for(const {id, cc} of stmts.getAllCC(false))
		serverToLang[id] = countryToLang[cc];
	let total = 0;

	function embedLocalizer(baseEmbed) {
		const {yt} = baseEmbed;
		const embeds = { en: { embeds: [baseEmbed] } };
		return channelId => channels.fetch(channelId).then(channel => {
			if(!channel.permissionsFor(channel.guild.members.me).has(REQUIRED_PERMS))
				return;

			const lang = serverToLang[channel.guild.id] || "en";
			if(!(lang in embeds))
			{
				const trEmbed = {...baseEmbed};
				trEmbed.fields[0].name = openInApps[lang];
				embeds[lang] = { embeds: [trEmbed] };
			}
			channel.send(embeds[lang]).catch(Function());
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
				steamWatchers.forEach(embedLocalizer(baseEmbed));
			}
			stmts.updateLatest({ appid: STEAM_APPID, latest: latestDate });
		});
	}

	await Promise.allSettled(stmts.findWatchedApps().map(appid => query(appid, 5).then(async ({appnews}) => {
		if(!appnews)
			return console.error(`Failed to get news of app ${id}`);

		const { latest, nsfw } = stmts.getAppInfo(appid);
		const news = [];
		for(const newsitem of appnews.newsitems)
		{
			if(newsitem.gid === latest)
				break;

			news.push(newsitem);
			if(!latest) break;
		}

		if(!news.length)
			return;

		const [{date: latestDate}] = news;
		total += news.length;
		for(const newsitem of news.reverse())
			stmts.getWatchers(appid).forEach(embedLocalizer(await toEmbed(newsitem)));

		stmts.updateLatest({ appid, latest: latestDate });
	})));

	return total;
}


/**
 * Triggers all price watchers.
 * @returns {Promise<int>} The number of price updates sent.
 */
exports.checkPrices = checkPrices;
async function checkPrices()
{
	const watchedPrices = {};
	const appsWithUpdatedPrices = [];

	for(const appDetails of stmts.findWatchedPrices())
		watchedPrices[appDetails.appid] = appDetails;

	for(const [appid, {final, discount_percent}= {}] of Object.entries(await queryPrices(Object.keys(watchedPrices))))
	{
		if(!final) continue; // Sometimes the API call just... fails

		const lastKnownPrice = watchedPrices[appid].lastPrice;
		if(final === lastKnownPrice)
			continue;

		stmts.updateLastPrice({appid, lastPrice: final});
		if(true || lastKnownPrice === null || final < watchedPrices[appid] || discount_percent)
			appsWithUpdatedPrices.push(appid);
	}

	const newPricesByCC = new Map();
	for(const appid of appsWithUpdatedPrices)
	{
		for(const {guildId, channelId, cc} of stmts.getPriceWatchers(appid))
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

	const { channels } = require("../bot").client;
	for(const [cc, appsForThisCC] of newPricesByCC)
	{
		const appids = [...appsForThisCC.keys()];
		queryPrices([...appsForThisCC.keys()], cc).then(appDetails => {
			for(const [appid, price] of Object.entries(appDetails))
			{
				if(!price) continue; // Sometimes the API call just... fails

				price.cc = cc;
				const { name, nsfw } = watchedPrices[appid];
				const embed = { embeds: [toEmbed.price(appid, name, price)] };
				for(const channelId of appsForThisCC.get(appid))
				{
					channels.fetch(channelId).then(channel => {
						if(channel.permissionsFor(channel.guild.members.me).has(REQUIRED_PERMS) && (!nsfw || channel.nsfw))
							channel.send(embed).catch(Function());
					}, Function());
				}
			}
		});
	}
}

/**
 * Adds a watcher for an app. A server can only watch 25 apps at once.
 * @param {int} appid The app's id.
 * @param {GuildChannel} channel The text-based channel to send the news to.
 * @param {boolean} price Whether to watch for price changes instead of news. Default: false
 *
 * @returns {Promise<int|false|null>} false if that app was already watched in that guild, or the new number of watched apps.
 * Rejects with a TypeError if either parameter is invalid, or with a RangeError if the server reached its limit of 25 apps.
 */
exports.watch = async (appid, channel, price = false, LIMIT = WATCH_LIMIT) => {
	if(!channel?.isTextBased() || !channel.guild)
		throw new TypeError("'channel' must be a text-based channel");

	const {appnews} = await query(appid);
	if(!appnews)
		throw new TypeError("'appid' is not a valid app id");

	const guildId = channel.guild.id;
	const watchedApps = stmts[price ? "getWatchedPrices" : "getWatchedApps"](guildId).map(({appid}) => appid);

	if(watchedApps.includes(appid))
		return false;
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
				appnews.newsitems[0]?.gid,
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

			if(price?.discount_percent && channel.permissionsFor(channel.guild.members.me).has(REQUIRED_PERMS))
			{
				const cc = price.cc = stmts.getCC(guildId) || "US";
				if(cc === "US")
					channel.send({ embeds: [toEmbed.price(appid, details.name, price)] }).catch(Function());
				else
					queryPrices(appid, cc)
						.then(prices => channel.send({ embeds: [toEmbed.price(appid, details.name, prices[appid])] }))
						.catch(Function())
			}
		}
	}

	stmts[price ? "watchPrice" : "watch"](appid, guildId, channel.id);
	return watchedApps.length + 1;
}



/**
 * Stops watching the given app in the given guild.
 * @param {int} appid The app's id.
 * @param {Guild} guild The guild.
 * @param {boolean} price Whether to unwatch for price changes instead of news. Default: false
 *
 * @returns {int|false} false if that guild was not watching that app, or the new number or apps watched by the guild.
 */
exports.unwatch = (appid, guild, price = false) => {
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
 * @returns {bool} true if the server was purged, false if there was nothing to purge.
 */
exports.purgeGuild = guildId => !!stmts.purgeGuild(guildId.id || guildId).changes;

/**
 * Removes all watchers of a channel.
 * @param {string} channelId The channel or channel id.
 * @returns {bool} true if the channel was purged, false if there was nothing to purge.
 */
exports.purgeChannel = channelId => !!stmts.purgeChannel(channelId.id || channelId).changes;


/**
 * Removes all watchers of an app.
 * @param {int} appid The app's id.
 * @returns {bool} true if the app was purged, false if there was nothing to purge.
 */
exports.purgeApp = appid => !!db.run("DELETE FROM Watchers WHERE appid = ?", appid).changes;
// Not prepared because it is only used in debug mode
