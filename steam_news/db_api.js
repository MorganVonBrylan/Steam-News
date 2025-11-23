
import db, { stmts } from "./db.js";

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
 * @type {function}
 * @param {number} appid The app's id
 * @returns {?string} The app's name, if known.
 */
export const getAppName = stmts.getAppName;
/**
 * @type {function}
 * @param {number} appid The app's id
 * @returns {?bool} Whether is app is NSFW, if known.
 */
const { isAppNSFW } = stmts;
export { isAppNSFW as isNSFW };

/**
 * @type {function}
 * @param {string} guildId The guild id
 * @returns {Array} The apps watched in that guild, in the format {appid, name, nsfw, channelId}
 */
export const getWatchedApps = stmts.getWatchedApps;

/**
 * @type {function}
 * @param {string} guildId The guild id
 * @returns {Array} The app prices watched in that guild, in the format {appid, name, nsfw, lastPrice, channelId}
 */
export const getWatchedPrices = stmts.getWatchedPrices;



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