"use strict";

const { existsSync, readFile, writeFile } = require("fs");
const { query, getDetails } = require("./api");

const watchedApps = {};
Object.defineProperty(watchedApps, "map", {value: callback => Object.entries(watchedApps).map(callback)});
const watchFile = __dirname + "/watchers.json";


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
	writeFile(watchFile, JSON.stringify(watchedApps), err => { if(err) console.error(err); saving = false; });
}

if(existsSync(watchFile))
{
	readFile(watchFile, "utf-8", (err, data) => {
		if(err)
			console.error(err);
		else
		{
			Object.assign(watchedApps, JSON.parse(data));
			checkForNews();
		}
	});
}
else
	checkForNews();



/**
 * @param {int} appid The app's id
 * @returns {?string} The app's name, if known.
 */
exports.getAppName = appid => watchedApps[appid]?.name;


setTimeout(checkForNews, 3600_000);
exports.checkForNews = checkForNews;

/**
 * Triggers all watchers.
 * @returns {Promise<int>} The number of news sent.
 */
exports.checkForNews = checkForNews;
async function checkForNews(save)
{
	const toEmbed = require("./toEmbed.function");
	const { channels } = require("../bot").client;
	var total = 0;

	await Promise.allSettled(watchedApps.map(([appid, {last, watchers}]) => query(appid, 10).then(({appnews}) => {
		if(!appnews)
			delete watchedApps[appid];
		else
		{
			const news = [];
			for(const newsitem of appnews.newsitems)
			{
				if(newsitem.gid === last)
					break;
				if(newsitem.feedname.includes("steam"))
				{
					news.push(newsitem)
					if(!last) break;
				}
			}

			if(news.length)
			{
				total += news.length;
				watchedApps[appid].last = news[0].gid;
				for(const newsitem of news.reverse())
				{
					const embed = { embeds: [toEmbed(newsitem)] };
					for(const channelId of Object.values(watchers))
						channels.fetch(channelId).then(channel => channel.send(embed).catch(console.error));
				}
			}
		}
	})));
	saveWatchers();
	return total;
}


/**
 * Adds a watcher for an app.
 * @param {int} appid The app's id.
 * @param {GuildChannel} channel The text-based channel to send the news to.
 *
 * @returns {Promise<bool>} true if the watcher was added, false if that app was already watched in that guild.
 */
exports.watch = async (appid, channel) => {
	if(!channel?.isText() || !channel.guild)
		throw new TypeError("'channel' must be a text-based channel");

	const {appnews} = await query(appid);
	if(!appnews)
		throw new TypeError("'appid' is not a valid app id");

	const guildId = channel.guild.id;
	if(appid in watchedApps)
	{
		if(guildId in watchedApps[appid].watchers)
			return false;
		watchedApps[appid].watchers[guildId] = channel.id;
	}
	else
	{
		const details = await getDetails(appid);
		const last = appnews.newsitems.find(({feedname}) => feedname.includes("steam"))?.gid;
		watchedApps[appid] = {
			name: details?.name || "undefined",
			last,
			watchers: { [guildId]: channel.id },
		 };
	}

	saveWatchers();
	return true;
}


/**
 * Stops watching the given app in the given guild.
 * @param {int} appid The app's id.
 * @param {Guild} guild The guild.
 *
 * @returns {bool} true if the watcher was removed, false if that channel was not watching that app.
 */
exports.unwatch = (appid, guild) => {
	if(guild.id)
		guild = guild.id;

	const watchers = watchedApps[appid]?.watchers;
	if(!watchers || !(guild in watchers))
		return false;

	delete watchers[guild];
	saveWatchers();
	return true;
}
