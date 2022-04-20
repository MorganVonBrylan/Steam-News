"use strict";

const { existsSync, promises: {readFile, writeFile, unlink} } = require("fs");
const { query, getDetails, isNSFW } = require("./api");
const { SEND_MESSAGES, EMBED_LINKS } = require("discord.js").Permissions.FLAGS;
const REQUIRED_PERMS = SEND_MESSAGES | EMBED_LINKS;

const watchFile = __dirname + "/watchers.json";
const WATCH_LIMIT = exports.WATCH_LIMIT = 25; // the maximum number of fields in an embed and a good limit overall


const db = require("./db");
const { stmts } = db;


require("../bot").client.once("ready", checkForNews);


/**
 * @param {int} appid The app's id
 * @returns {bool} Whether the app is known by the bot or not.
 */
exports.isKnown = appid => !!stmts.isAppKnown(appid);

/**
 * @param {int} appid The app's id
 * @returns {?object} The app info (name, NSFW status and latest news gid), if known.
 */
exports.getAppInfo = stmts.getAppInfo;

/**
 * Stores or updates the given app info.
 * @param {int} appid The app's id.
 * @param {object} details The relevant details (all optional except the name)
 	* @param {string} details.name The app's name
 	* @param {bool} details.nsfw Whether the app is NSFW or not.
	* @param {string} details.latest That app's latest news' gid.
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
 * @returns {Array} The apps watched in that guild, in the format {appid, name, channelId}
 */
exports.getWatchedApps = stmts.getWatchedApps;


setInterval(checkForNews, 3600_000);

const toEmbed = require("./toEmbed.function");

/**
 * Triggers all watchers.
 * @returns {Promise<int>} The number of news sent.
 */
exports.checkForNews = checkForNews;
async function checkForNews()
{
	const { channels } = require("../bot").client;
	let total = 0;

	await Promise.allSettled(stmts.findWatchedApps().map(appid => query(appid, 5).then(({appnews}) => {
		if(!appnews)
			return console.error(`Failed to get news of app ${id}`);

		const { latest, nsfw } = stmts.getAppInfo(appid);
		const news = [];
		for(const newsitem of appnews.newsitems)
		{
			if(newsitem.gid === latest)
				break;

			news.push(newsitem)
			if(!latest) break;
		}

		if(news.length)
		{
			total += news.length;
			for(const newsitem of news.reverse())
			{
				const embed = { embeds: [toEmbed(newsitem)] };
				const {yt} = embed.embeds[0];
				for(const channelId of stmts.getWatchers(appid))
				{
					channels.fetch(channelId).then(channel => {
						if(channel.permissionsFor(channel.guild.me).has(REQUIRED_PERMS) && (!nsfw || channel.nsfw))
						{
							channel.send(embed).catch(console.error);
							if(yt)
								channel.send(yt).catch(Function());
						}
					}, Function());
				}
			}
			stmts.updateLatest({ appid, latest: news[0].gid });
		}
	})));

	return total;
}


/**
 * Adds a watcher for an app. A server can only watch 25 apps at once.
 * @param {int} appid The app's id.
 * @param {GuildChannel} channel The text-based channel to send the news to.
 *
 * @returns {Promise<int|false>} false if that app was already watched in that guild, or the new number of watched apps.
 * Rejects with a TypeError if either parameter is invalid, or with a RangeError if the server reached its limit of 25 apps.
 */
exports.watch = async (appid, channel) => {
	if(!channel?.isText() || !channel.guild)
		throw new TypeError("'channel' must be a text-based channel");

	const {appnews} = await query(appid);
	if(!appnews)
		throw new TypeError("'appid' is not a valid app id");

	const guildId = channel.guild.id;
	const watchedApps = stmts.getWatchedApps(guildId).map(({appid}) => appid);

	if(watchedApps.includes(appid))
		return false;
	if(watchedApps.length === WATCH_LIMIT)
		throw new RangeError(`This server reached its limit of ${WATCH_LIMIT} watched apps.`);

	if(!stmts.isAppKnown(appid))
	{
		const details = await getDetails(appid);
		if(!details) throw new Error(`Failed to get details of app ${appid}`);
		stmts.insertApp(appid, details.name, isNSFW(details)+0, appnews.newsitems[0]?.gid);
	}

	stmts.watch(appid, guildId, channel.id);

	return watchedApps.length + 1;
}


/**
 * Stops watching the given app in the given guild.
 * @param {int} appid The app's id.
 * @param {Guild} guild The guild.
 *
 * @returns {int|false} false if that guild was not watching that app, or the new number or apps watched by the guild.
 */
exports.unwatch = (appid, guild) => {
	const guildId = guild.id || guild;
	return stmts.unwatch(appid, guildId).changes
		? stmts.getWatchedApps(guildId).length
		: false;
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
