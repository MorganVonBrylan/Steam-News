"use strict";

const fetch = require("node-fetch");
const BASE_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?feeds=steam_community_announcements&appid=";
const BASE_DETAILS_URL = "https://store.steampowered.com/api/appdetails?appids=";

const headers = { "Accept-Language": "fr,en" };

/**
 * Queries the Steam API to get the latest news of an app.
 * @param {int} appid The id of the Steam app
 * @param {int} count (optional) The number of news to fetch
 * @param {int} maxlength (optional) The max length of the 'contents' field. Any additional characters will be replaced with '...'. Set null to prevent truncating.
 *
 * @returns {Promise<object>} The news
 */
exports.query = query;
function query(appid, count, maxlength = 1000)
{
	if(!appid) throw new TypeError("appid cannot be null");
	let url = BASE_URL + appid;
	if(count) url += `&count=${count}`;
	if(maxlength) url += `&maxlength=${maxlength}`;

	return fetch(url, {headers}).then(res => res.json());
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
 * Returns details about an app.
 * @param {int} appid The app's id.
 * @returns {Promise<object?>} The app's details, or null if it doesn't exist.
 */
exports.getDetails = appid => fetch(BASE_DETAILS_URL+appid, {headers}).then(res => res.json()).then(details => {
	details = details[appid];
	return details.success ? details.data : null;
});

/**
 * Checks if the given app is NSFW.
 * @param {object} appDetails The app's details.
 * @returns {bool}
 */
exports.isNSFW = appDetails => {
	const notes = appDetails.content_descriptors.notes?.toLowerCase();
	return notes && (notes.includes("nudity") || notes.includes("sex"));
}
