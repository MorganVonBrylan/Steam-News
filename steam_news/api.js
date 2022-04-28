"use strict";

const fetch = require("node-fetch");
// ISteamNews doc: https://partner.steamgames.com/doc/webapi/ISteamNews
const BASE_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?feeds=steam_community_announcements&appid=";
// Steam Store API unofficial doc: https://wiki.teamfortress.com/wiki/User:RJackson/StorefrontAPI
const BASE_DETAILS_URL = "https://store.steampowered.com/api/appdetails?appids=";
const BASE_PRICE_URL = "https://store.steampowered.com/api/appdetails?filters=price_overview&appids=";
const BASE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/?l=english";


/**
 * Searches the Steam store for apps.
 * @param {string} terms The research terms.
 * @param {string} cc The country code, for price purposes (e.g. "FR", "UK", etc). Default: "US"
 *
 * @returns {Promise<Array>} The results (up to 10)
 */
exports.search = function search(terms, cc = "US")
{
	return fetch(`${BASE_SEARCH_URL}&term=${terms}&cc=${cc}`).then(async res => (await res.json()).items);
}


// So far ISteamNews has no language arg and ignores the Accept-Language headeer :-(

/**
 * Queries the Steam API to get the latest news of an app.
 * @param {int} appid The id of the Steam app
 * @param {int} count (optional) The number of news to fetch
 * @param {int} maxlength (optional) The max length of the 'contents' field. Any additional characters will be replaced with '...'. This also removes all PHPBB syntax.
 *
 * @returns {Promise<object>} The news
 */
exports.query = query;
function query(appid, count, maxlength)
{
	if(!appid) throw new TypeError("appid cannot be null");
	let url = BASE_URL + appid;
	if(count) url += `&count=${count}`;
	if(maxlength) url += `&maxlength=${maxlength}`;

	return fetch(url).then(res => res.json());
}


/**
 * Helper function to know if an appid is valid or not.
 * @param {int} appid The app's id.
 * @returns {Promise<bool>} true or false
 */
exports.exists = async appid => {
	const {appnews} = await query(appid, 1, 1);
	return !!appnews;
}


/**
 * Queries prices for one or more apps.
 * @param {number|Array<number>} appids The app id(s)
 * @param {string} cc The country code for the price (e.g. "FR", "UK", etc). Default: "US"
 * @returns {Promise<object>} A promise resolving to a dictionary of appid => price_overview pairs.
 */
exports.queryPrices = (appids, cc = "US") => {
	if(appids instanceof Array)
		appids = appids.join(",");

	return fetch(BASE_PRICE_URL+appids+`&cc=${cc}`).then(data => data.json()).then(data => {
		for(const appid in data)
			data[appid] = data[appid].data?.price_overview;
		return data;
	});
}


/**
 * Returns details about an app.
 * @param {int} appid The app's id.
 * @param {string} lang (optional) The language to get the details in. Default: en
 * @returns {Promise<object?>} The app's details, or null if it doesn't exist.
 */
exports.getDetails = (appid, lang = "en", cc = "US") => {
	cc = `&cc=${cc}`;
	return fetch(BASE_DETAILS_URL+appid+cc, {headers: { "Accept-Language": lang === "en" ? "en" : `${lang}, en` }})
	.then(res => res.json()).then(details => {
		details = details[appid];
		return details.success ? details.data : null;
	});
}

/**
 * Checks if the given app is NSFW.
 * @param {object} appDetails The app's details.
 * @returns {bool}
 */
exports.isNSFW = appDetails => {
	const notes = appDetails.content_descriptors.notes?.toLowerCase();
	return notes && (notes.includes("nudity") || notes.includes("sex"));
}
