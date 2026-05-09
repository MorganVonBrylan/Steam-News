
import db, { stmts } from "./db.js";
import { STEAM_APPID } from "./api.js";
import { fixedDictionary } from "../utils/dictionaries.js";

/**
 * @typedef {import("./db.js").NewsWatcher} NewsWatcher
 * @typedef {import("./db.js").SteamWatcher} SteamWatcher
 * @typedef {import("./db.js").PriceWatcher} PriceWatcher
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
 * @type {(guildId:string)=>?string}
 * Get a server's country code
 */
export const getCC = stmts.getCC;
/**
 * @type {(guildId:string)=>?{cc:string, lang:string}}
 * Get a server's locale
 */
export const getLocale = stmts.getLocale;
/**
 * @type {(guildId:string, cc:string, lang:string)=>boolean}
 * Change a server's locale
 * @param guildId The guild id
 * @param cc The 2-letter country code
 * @param lang The language code (e.g fr or en-US)
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
		const channelId = stmts.getSteamWatcher(guildId);
		if(channelId)
			apps.push({appid: STEAM_APPID, name: "Steam News Hub", nsfw: false, channelId});
	}
	return apps;
}

/** @type {(appid:number)=>boolean} Get whether an app is watched in at least one server. */
export const isWatched = stmts.isWatched;
/** @type {()=>boolean} Check whether Steam is watched in at least one server. */
export const isSteamWatched = stmts.isSteamWatched;

const watcherGetters = fixedDictionary({
	news: stmts.getWatcher,
	price: stmts.getPriceWatcher,
	steam: ({guildId}) => stmts.getSteamWatcher(guildId),
});
/**
 * Get watcher data for a specific app+guild.
 * @param {"news"|"price"|"steam"} type The watcher type
 * @param {{appid:number, guildId:string}} guildAndAppIds An object contraining the guildId and appid (appid not necessary for a Steam watcher)
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

const channelGetters = fixedDictionary({
	news: stmts.getWatcherChannel,
	price: stmts.getPriceWatcherChannel,
	steam: ({guildId}) => stmts.getSteamChannel(guildId),
});
/**
 * Get the channel of a watcher.
 * @param {"news"|"price"|"steam"} type The watcher type
 * @param {{guildId:string, appid:string}} guildAndAppIds An object containing the guildId and appid (appid not necessary for a Steam watcher)
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
});
/**
 * @param {"news"|"price"|"steam"} type The watcher type
 * @param {{appid: number, channelId: string, webhook: string}} params
 * @param {number} params.appid The appid
 * @param {string} params.channelId The channel id
 * @param {WebhookInfo} params.webhook The webhook info
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
});
/**
 * @overload
 * @param {"steam"} type
 * @param {"string"|{guildId:string}} params
 * @returns {?WebhookInfo} The webhook info, or null is none was set for that type and app
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
 * @param {string|{guildId: string, appid?:string}} params
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
 * @type {{
 * (guildId: string)=>({type:"news"|"price", appid:number, name:string, channelId: string,webhook: WebhookInfo}|{type:"steam",channelId:string, webhook:WebhookInfo})[];
 * (guildId: string, merge: false)=>({news: {appid:number, name:string, channelId:string, webhook:WebhookInfo}[], price: {appid:number, name:string, channelId:string, webhook:WebhookInfo}[], steam: ?{channelId:string, webhook:WebhookInfo}});
 * }}
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
 * @type {(guildId: string)=>({type: "news"|"price", appid: number, name: string, channelId: string}|{type: "steam", channelId: string})[]}
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
 * Removes all watchers of an app.
 * @param {number} appid The app's id.
 * @returns {boolean} true if the app was purged, false if there was nothing to purge.
 */
export const purgeApp = appid => !!db.run("DELETE FROM Apps WHERE appid = ?", appid).changes;
// Not prepared because it is rare


/**
 * @type {()=>{watchers:number, watchedApps:number, priceWatchers:number, watchedPrices:number, mostWatchedName:string, mostWatchedTotal:number}}
 * Get the bot's watcher statistics.
 */
export const getStats = stmts.getStats;