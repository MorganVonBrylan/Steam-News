"use strict";

const { existsSync, promises: {readFile, writeFile} } = require("fs");
const { query, getDetails, isNSFW } = require("./api");
const { SEND_MESSAGES, EMBED_LINKS } = require("discord.js").Permissions.FLAGS;
const REQUIRED_PERMS = SEND_MESSAGES | EMBED_LINKS;
const watchedApps = {servers: {}, apps: {}};
const watchFile = __dirname + "/watchers.json";
const WATCH_LIMIT = exports.WATCH_LIMIT = 25; // the maximum number of fields in an embed and a good limit overall


let saving = false;
function saveWatchers()
{
	if(saving)
	{
		if(saving !== "timeoutScheduled")
		{
			saving = "timeoutScheduled";
			setTimeout(saveWatchers, 500);
		}
		return;
	}

	saving = true;
	writeFile(watchFile, JSON.stringify(watchedApps)).catch(console.error).finally(() => saving = false);
}

if(existsSync(watchFile))
{
	readFile(watchFile, "utf-8").then(data => {
		Object.assign(watchedApps, JSON.parse(data));
		require("../bot").client.once("ready", checkForNews);
	}, console.error);
}
else
	require("../bot").client.once("ready", checkForNews);


/**
 * @param {int} appid The app's id
 * @returns {bool} Whether the app is known by the bot or not.
 */
exports.isKnown = appid => appid in watchedApps.apps;

/**
 * @param {int} appid The app's id
 * @returns {?object} The app info (name, NSFW status and latest news gid), if known.
 */
exports.getAppInfo = appid => {
	const app = watchedApps.apps[appid];
	return app ? { name: app.name, nsfw: app.nsfw, latest: app.latest } : null;
}

/**
 * Stores or updates the given app info.
 * @param {int} appid The app's id.
 * @param {object} details The relevant details
 	* @param {string} details.name The app's name
 	* @param {bool} details.nsfw Whether the app is NSFW or not.
	* @param {string} details.latest That app's latest news' gid.
 */
exports.saveAppInfo = (appid, {name, nsfw, latest}) => {
	let app = watchedApps.apps[appid];
	if(!app) app = watchedApps.apps[appid] = {watchers: {}};
	if(typeof name === "string") app.name = name;
	if(typeof nsfw === "boolean") app.nsfw = nsfw;
	if(typeof latest === "string") app.latest = latest;
	saveWatchers();
};

/**
 * @param {int} appid The app's id
 * @returns {?string} The app's name, if known.
 */
exports.getAppName = appid => watchedApps.apps[appid]?.name;
/**
 * @param {int} appid The app's id
 * @returns {?bool} Whether is app is NSFW, if known.
 */
exports.isNSFW = appid => watchedApps.apps[appid]?.nsfw;

/**
 * @param {string} guildId The guild id
 * @returns {Array} The apps watched in that guild, in the format {appid, name, channelId}
 */
exports.getWatchedApps = guildId => {
	const guild = watchedApps.servers[guildId] || [];
	return guild.map(appid => {
		const app = watchedApps.apps[appid];
		return { appid, name: app.name, nsfw: app.nsfw, channelId: app.watchers[guildId] };
	});
}


setInterval(checkForNews, 3600_000);

/**
 * Triggers all watchers.
 * @returns {Promise<int>} The number of news sent.
 */
exports.checkForNews = checkForNews;
async function checkForNews(save)
{
	const toEmbed = require("./toEmbed.function");
	const { channels } = require("../bot").client;
	let total = 0;
	const apps = Object.entries(watchedApps.apps).filter(([,{watchers}]) => Object.keys(watchers).length);

	await Promise.allSettled(apps.map(([appid, app]) => query(appid, 5).then(({appnews}) => {
		if(!appnews)
			exports.purgeApp(appid);
		else
		{
			const { latest, nsfw } = app;
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
				app.latest = news[0].gid;
				for(const newsitem of news.reverse())
				{
					const embed = { embeds: [toEmbed(newsitem)] };
					for(const channelId of Object.values(app.watchers))
						channels.fetch(channelId).then(channel => {
							if(channel.permissionsFor(channel.guild.me).has(REQUIRED_PERMS)
								&& (!nsfw || channel.nsfw))
								channel.send(embed).catch(console.error);
						});
				}
			}
		}
	}, console.error)));

	if(total)
		saveWatchers();
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
	const {apps, servers} = watchedApps;

	if(guildId in servers)
	{
		if(servers[guildId].includes(appid))
			return false;
		if(servers[guildId].length === WATCH_LIMIT)
			throw new RangeError(`This server reached its limit of ${WATCH_LIMIT} watched apps.`);
		servers[guildId].push(appid);
	}
	else
		servers[guildId] = [appid];

	if(appid in apps)
		apps[appid].watchers[guildId] = channel.id;
	else
	{
		const details = await getDetails(appid);
		apps[appid] = {
			name: details?.name || "undefined",
			nsfw: details ? isNSFW(details) : null,
			latest: appnews.newsitems[0]?.gid,
			watchers: { [guildId]: channel.id },
		 };
	}

	saveWatchers();
	return servers[guildId].length;
}


/**
 * Stops watching the given app in the given guild.
 * @param {int} appid The app's id.
 * @param {Guild} guild The guild.
 *
 * @returns {int|false} false if that guild was not watching that app, or the new number or apps watched by the guild.
 */
exports.unwatch = (appid, guild) => {
	if(guild.id)
		guild = guild.id;

	const watchers = watchedApps.apps[appid]?.watchers;
	if(!watchers || !(guild in watchers))
		return false;

	const server = watchedApps.servers[guild];
	server.splice(server.indexOf(appid), 1);
	delete watchers[guild];
	if(!Object.keys(watchers).length)
		watchedApps.apps[appid].latest = null;
	saveWatchers();
	return server.length;
}


/**
 * Removes all watchers of a guild.
 * @param {string} guildId The guild or guild id.
 * @returns {bool} true if the server was purged, false if there was nothing to purge.
 */
exports.purgeGuild = guildId => {
	if(guildId.id)
		guildId = guildId.id;

	const {servers, apps} = watchedApps;
	const server = servers[guildId];
	if(!server)
		return false;

	for(const appid of server)
	{
		try {
			delete apps[appid].watchers[guildId];
			if(!Object.keys(apps[appid].watchers).length)
				apps[appid].latest = null;
		} catch(e) {
			e.message += `\nappid: ${appid}`;
			error(e);
		}
	}
	delete servers[guildId];
	saveWatchers();
	return true;
}

/**
 * Removes all watchers of an app.
 * @param {int} appid The app's id.
 * @returns {bool} true if the app was purged, false if there was nothing to purge.
 */
exports.purgeApp = appid => {
	const {apps} = watchedApps;
	if(!apps[appid])
		return false;

	for(let server of Object.keys(apps[appid].watchers))
	{
		server = watchedApps.servers[server];
		server.splice(server.indexOf(appid), 1);
	}
	delete apps[appid];
	saveWatchers();
	return true;
}
