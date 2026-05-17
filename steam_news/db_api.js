
import db, { stmts } from "./db.js";
import { STEAM_APPID } from "./api.js";
import { fixedDictionary } from "../utils/dictionaries.js";

/**
 * @typedef {import("./db.js").NewsWatcher} NewsWatcher
 * @typedef {import("./db.js").SteamWatcher} SteamWatcher
 * @typedef {import("./db.js").PriceWatcher} PriceWatcher
 * @typedef {import("./db.js").GroupWatcher} GroupWatcher
 * @typedef {"news"|"price"|"steam"|"group"} WatcherType
 * @typedef {{clanid:number, name:string, vanityURL:string, latest:number}} Group
 */

/**
 * @param {number} appid The app's id
 * @returns {boolean} Whether the app is known by the bot or not.
 */
export const isKnown = appid => !!stmts.isAppKnown(appid);

/**
 * @type {function}
 * @param {number} appid The app's id
 * @returns {?object} The app info (name, NSFW status and latest news timestamp), if known.
 */
export const getAppInfo = stmts.getAppInfo;

/**
 * Stores or updates the given app info.
 * @param {number} appid The app's id.
 * @param {{name:string, nsfw?:boolean, latest?:number, lastPrice?:number}} details The relevant details
 */
export function saveAppInfo(appid, details)
{
	if(typeof details.nsfw === "boolean")
		details.nsfw = +details.nsfw; // better-sqlite3 refuses to bind booleans (see #262)

	if(stmts.isAppKnown(appid))
	{
		details.appid = appid;
		db.run(`UPDATE Apps SET ${fields.map(f => `${f} = $${f}`).join()} WHERE appid = $appid`, details);
	}
	else
	{
		const { name, nsfw = null, latest = null, lastPrice = null } = details;
		stmts.insertApp(appid, name, nsfw, latest, lastPrice);
	}
};

/**
 * @type {(appid:number)=>string|undefined}
 * @param {number} appid The app's id
 * @returns The app's name, if known.
 */
export const getAppName = stmts.getAppName;
/**
 * @type {(appid:number)=>?boolean}
 * @param {number} appid The app's id
 * @returns Whether is app is NSFW, if known.
 */
export const isNSFW = stmts.isAppNSFW;


/**
 * @type {(clanid:number)=>(Group)|undefined}
 * @param {number} clanid The group's id
 * @returns The group data
 */
export const getGroupInfo = stmts.getGroupInfo;
/**
 * @type {(clanid:number)=>string|undefined}
 * @param {number} clanid The group's id
 * @returns The group name
 */
export const getGroupName = stmts.getGroupName;
/**
 * @type {(name:string)=>Group|undefined}
 * @param {string} name The group's exact name (this is case-insensitive)
 * @returns The group, if it is known
 */
export const getGroupByName = stmts.getGroupByName;

/**
 * @type {(clanid:number, name:string, vanityURL:string, latest:?number)=>never}
 * @param {number} clanid The group's id
 * @param {string} name The group's name
 * @param {string} vanityURL The unique part in a /groups/vanityURL address
 * @param {number} latest UNIX timestamp in seconds of that group's latest post
 */
export const saveGroupInfo = stmts.insertGroup;

/**
 * @type {(info:{clanid:string, group_name:string, vanity_url:string})=>boolean}
 * Update a group's name and vanity URL. Properties are name so that the result of the ajaxgetvanityandclanid can be user directly.
 * @returns true if the group was updated, false if it wasn't in the database.
 */
export const updateGroupInfo = info => !!stmts.updateGroup(info).changes;

/**
 * @type {(params: {clanid:number, latest:?number})=>*}
 * Update the latest known post date for a group.
 * @param params.clanid The clan id
 * @param params.latest A UNIX timestamp in seconds
 */
export const updateLatestPost = stmts.updateLatestPost;


/**
 * @type {(guildId:string)=>?string}
 * Get a server's country code
 */
export const getCC = stmts.getCC;
/**
 * @type {(guildId:string)=>?{cc:string, lang:string}}
 * Get a server's locale. 'lang' is a Steam language name.
 */
export const getLocale = stmts.getLocale;
/**
 * @type {(guildId:string, cc:string, lang:string)=>boolean}
 * Change a server's locale
 * @param guildId The guild id
 * @param cc The 2-letter country code
 * @param lang The language name (e.g french or english)
 * @returns Whether the locale was set
 */
export const setLocale = stmts.setLocale;

/**
 * @type {(guildId:string)=>?string}
 * Get the channel where Steam news are sent.
 * @param guildId The guild id
 * @returns The channel id, or null if Steam is not watched in this server.
 */
export const getSteamChannel = stmts.getSteamChannel;


/**
 * @type {(params: {appid:number, latest:?number})=>*}
 * Update the latest known news date for an app.
 * @param params.appid The app id
 * @param params.latest A UNIX timestamp in seconds
 */
export const updateLatest = stmts.updateLatest;

/**
 * @param {string} guildId The guild id
 * @param {boolean} includeSteam Whether to include the Steam News Hub. It will always be the last element.
 * @returns {NewsWatcher[]} The apps watched in that guild, in the format {appid, name, nsfw, channelId}
 */
export function getWatchedApps(guildId, includeSteam = false)
{
	const apps = stmts.getWatchedApps(guildId);
	if(includeSteam)
	{
		const watcher = stmts.getSteamWatcher(guildId);
		if(watcher)
		{
			Object.assign(watcher, {appid: STEAM_APPID, name: "Steam News Hub", nsfw: false});
			apps.push(watcher);
		}
	}
	return apps;
}

/** @type {(appid:number)=>boolean} Get whether an app is watched in at least one server. */
export const isWatched = stmts.isWatched;
/** @type {()=>boolean} Check whether Steam is watched in at least one server. */
export const isSteamWatched = stmts.isSteamWatched;
/** @type {(clanid:number)=>boolean} Check whether a group is watched in at least one server. */
export const isGroupWatched = stmts.isGroupWatched;

const watcherGetters = fixedDictionary({
	news: stmts.getWatcher,
	price: stmts.getPriceWatcher,
	steam: ({guildId}) => stmts.getSteamWatcher(guildId),
	group: stmts.getGroupWatcher,
});
/**
 * Get watcher data for a specific app+guild.
 * @param {WatcherType} type The watcher type
 * @param {{appid?:number, guildId:string}|{clanid:number, guildId:string}} guildAndAppIds An object contraining the guildId and appid (appid not necessary for a Steam watcher)
 * @returns {NewsWatcher|PriceWatcher|SteamWatcher} The watcher data
 */
export function getWatcher(type, guildAndAppIds)
{
	return watcherGetters[type](guildAndAppIds);
}

/**
 * @type {(guildId:string)=>PriceWatcher[]}
 * @param {string} guildId The guild id
 * @returns The app prices watched in that guild, in the format {appid, name, nsfw, lastPrice, channelId}
 */
export const getWatchedPrices = stmts.getWatchedPrices;

/**
 * @type {(guildId:string)=>GroupWatcher[]}
 * @param {string} guildId The guild id
 * @returns The app prices watched in that guild, in the format {appid, name, nsfw, lastPrice, channelId}
 */
export const getWatchedGroups = stmts.getWatchedGroups;

const channelGetters = fixedDictionary({
	news: stmts.getWatcherChannel,
	price: stmts.getPriceWatcherChannel,
	steam: ({guildId}) => stmts.getSteamChannel(guildId),
	group: stmts.getGroupWatcherChannel,
});
/**
 * Get the channel of a watcher.
 * @param {WatcherType} type The watcher type
 * @param {{guildId:string, appid:string}|{guildId:string, clanid:string}} guildAndAppIds An object containing the guildId and appid (appid not necessary for a Steam watcher)
 * @returns {string} the channel id
 */
export function getWatcherChannel(type, guildAndAppIds)
{
	return channelGetters[type](guildAndAppIds);
}


/** @typedef {import("../commands/premium/chameleon/~webhook.js").WebhookInfo} WebhookInfo */

const webhookSetters = fixedDictionary({
	news: stmts.setWebhook,
	price: stmts.setPriceWebhook,
	steam: stmts.setSteamWebhook,
	group: stmts.setGroupWebhook,
});
/**
 * @param {WatcherType} type The watcher type
 * @param {{appid: number, channelId: string, webhook: WebhookInfo}|{clanid: number, channelId: string, webhook: WebhookInfo}} params
 * @returns {boolean} true if the watcher was updated, false if it couldn't be found
 */
export function setWebhook(type, params)
{
	return !!webhookSetters[type](params);
}

const webhookGetters = fixedDictionary({
	news: stmts.getWebhook,
	price: stmts.getPriceWebhook,
	steam: stmts.getSteamWebhook,
	group: stmts.getGroupWebhook,
});
/**
 * @overload
 * @param {"group"} type
 * @param {{guildId:string, clanid:string}} params
 * @returns {?WebhookInfo} The webhook info, or null is none was set for that group
 */
/**
 * @overload
 * @param {"steam"} type
 * @param {"string"|{guildId:string}} params
 * @returns {?WebhookInfo} The webhook info, or null is none was set
 */
/**
 * @overload
 * @param {"news"|"price"} type
 * @param {{guildId:string, appid:string}} params
 * @returns {?WebhookInfo} The webhook info, or null is none was set for that type and app
 */
/**
 * Returns the webhook for a given app in a given server.
 * @param {string} type
 * @param {string|{guildId:string, appid?:string, clanid?:string}} params
 */
export function getWebhook(type, params)
{
	if(type === "steam" && params.guildId) params = params.guildId;
	return webhookGetters[type](params);
}

/**
 * @type {(channelId: string)=>string[]}
 * Get the webhooks of a given channel.
 * @returns A list of distinct webhook id/tokens.
 */
export const getChannelWebhooks = stmts.getChannelWebhooks;


/**
 * @type {((guildId:string)=>({type:"news"|"price", appid:number, name:string, channelId:string,webhook:WebhookInfo}|{type:"steam", channelId:string, webhook:WebhookInfo}|{type:"group", clanid:string, channelId:string, webhook:WebhookInfo})[]) & (guildId:string, merge:false)=>({news: {appid:number, name:string, channelId:string, webhook:WebhookInfo}[], price: {appid:number, name:string, channelId:string, webhook:WebhookInfo}[], steam: ?{channelId:string, webhook:WebhookInfo}, group: {clanid:string, channelId:string, webhook:WebhookInfo}[]})}
 * Returns all the whatchers with a webhook of a given server.
 * @param {string} guildId The guild id.
 * @param {boolean} [merge] Whether to merge the results into an array. Defaults to true.
 * @returns A list of watchers
 */
export const getWebhooks = stmts.getWebhooks;


/**
 * @type {(guildId: string)=>number}
 * Decouples all webhooks of a guild from their webhooks.
 * @param {string} guildId The guild id
 * @returns The number of rows affected
 */
export const decoupleWebhooks = stmts.decoupleWebhooks;

/**
 * @type {(guildId: string)=>({type:"news"|"price", appid:number, name:string, channelId:string}|{type:"steam", channelId:string}|{type:"group", clanid:number, name:string, channelId:string})[]}
 * Opposite of getWebhooks: return all the watchers of a server without a webhook.
 * @param {string} guildId The guild id.
 * @returns A list of watchers
 */
export const getNonWebhooks = stmts.getNonWebhooks;

/**
 * @type {(webhook:string)=>boolean}
 * Sets all watchers using the provided webhook to use the channel instead.
 * @param {string} webhook The webhook id or id/token.
 * @returns true if the server was purged, false if there was nothing to purge.
 */
export const purgeWebhook = stmts.purgeWebhook;



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
 * Removes an app and all its watchers.
 * @param {number} appid The app's id.
 * @returns {boolean} true if the app was purged, false if there was nothing to purge.
 */
export const purgeApp = appid => !!db.run("DELETE FROM Apps WHERE appid = ?", appid).changes;
// Not prepared because it is rare

/**
 * Removes a group and all its watchers.
 * @param {number} clanid The group's id.
 * @returns {boolean} true if the group was purged, false if there was nothing to purge.
 */
export const purgeGroup = clanid => !!db.run("DELETE FROM Groups WHERE clanid = ?", clanid).changes;


/**
 * @type {()=>{watchers:number, watchedApps:number, priceWatchers:number, watchedPrices:number, steamWatchers:number, mostWatchedName:string, mostWatchedTotal:number, mostWatchedGroup:string, mostWatchedGroupTotal:number}}
 * Get the bot's watcher statistics.
 */
export const getStats = stmts.getStats;