
// ISteamNews doc: https://partner.steamgames.com/doc/webapi/ISteamNews
const BASE_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2";
const NEWS_URL = `${BASE_URL}?feeds=steam_community_announcements&appid=`;
// Steam Store API unofficial doc: https://wiki.teamfortress.com/wiki/User:RJackson/StorefrontAPI
const STORE_BASE_URL = "https://store.steampowered.com/api/";
const BASE_DETAILS_URL = `${STORE_BASE_URL}appdetails?appids=`;
const BASE_PRICE_URL = `${STORE_BASE_URL}appdetails?filters=price_overview&appids=`;
const BASE_SEARCH_URL = `${STORE_BASE_URL}storesearch/?l=english`;

export const STEAM_APPID = 593110;
const STEAM_NEWS_URL = `${BASE_URL}?appid=${STEAM_APPID}`;
export const STEAM_ICON = "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/593110/403da5dab6ce5ea2882dc5b7636d7c4dbb73c81a.jpg";



function handleQuery(res, retry = true)
{
	if(res.ok && res.headers.get("Content-Type").startsWith("application/json"))
		return res.json();
	
	const { status, url } = res;
	if(retry && status !== 403 && status !== 404)
	{
		if(status < 500)
			res.text().then(body => {
				const err = new Error(`Got ${status} ${res.statusText} while querying ${url}`);
				error(Object.assign(err, {
					httpStatus: status,
					responseBody: body,
				}));
			});
		return fetch(url).then(res => handleQuery(res, false));
	}
	else
		throw new Error(res.ok ? "Query did not return JSON" : `Query ended with code ${status}`);
}


/**
 * Returns a link to open the Steam app that works in Discord.
 * @param {string} steamLink The steam:// link
 * @param {string} lang A 2-letter language code
 *
 * @returns {string} a Markdown link
 */
export function steamAppLink(steamLink, lang = "en")
{
	const text = steamLink.startsWith("steam://") ? steamLink : `steam://${steamLink}`;
	return `[${text}](https://brylan.fr/steam?s=${encodeURI(steamLink)}&l=${lang})`;
}


/**
 * Searches the Steam store for apps.
 * @param {string} terms The research terms.
 * @param {string} cc The country code, for price purposes (e.g. "FR", "UK", etc). Default: "US"
 *
 * @returns {Promise<Array>} The results (up to 10)
 */
export async function search(terms, cc = "US")
{
	const res = await fetch(`${BASE_SEARCH_URL}&term=${terms}&cc=${cc}`);
	const { items } = await res.json();
	return items;
}


// So far ISteamNews has no language arg and ignores the Accept-Language headeer :-(

/**
 * Queries the Steam API to get the latest news of an app.
 * @param {number} appid The id of the Steam app
 * @param {number} count (optional) The number of news to fetch
 * @param {number} maxlength (optional) The max length of the 'contents' field. Any additional characters will be replaced with '...'. This also removes all PHPBB syntax.
 *
 * @returns {Promise<object>} The news
 */
export function query(appid, count, maxlength)
{
	if(!appid) throw new TypeError("appid cannot be null");
	let url = NEWS_URL + appid;
	if(count) url += `&count=${count}`;
	if(maxlength) url += `&maxlength=${maxlength}`;

	return fetch(url).then(handleQuery);
}


/**
 * Queries the Steam API to get the latest Steam news.
 * @param {number} count (optional) The number of news to fetch
 * @param {number} maxlength (optional) The max length of the 'contents' field. Any additional characters will be replaced with '...'. This also removes all PHPBB syntax.
 *
 * @returns {Promise<object>} The news
 */
export async function querySteam(count, maxlength)
{
	let url = STEAM_NEWS_URL;
	if(count) url += `&count=${count}`;
	if(maxlength) url += `&maxlength=${maxlength}`;

	return fetch(url).then(handleQuery);
}


/**
 * Adds the event id corresponding to the given news item.
 * @param {object} newsItem The news item.
 * @returns {string} The evend id
 */
export async function getEventId(newsItem)
{
	const redirect = (await fetch(newsItem.url, {method: "HEAD"})).url;
	return newsItem.eventId = redirect.substring(redirect.lastIndexOf("/") + 1);;
}


/**
 * Helper function to know if an appid is valid or not.
 * @param {number} appid The app's id.
 * @returns {Promise<boolean>} true or false
 */
export async function exists(appid)
{
	const {appnews} = await query(appid, 1, 1);
	return !!appnews;
}


/**
 * Queries prices for one or more apps.
 * @param {number|Array<number>} appids The app id(s)
 * @param {string} cc The country code for the price (e.g. "FR", "UK", etc). Default: "US"
 * @returns {Promise<object>} A promise resolving to a dictionary of appid => price_overview pairs.
 */
export async function queryPrices(appids, cc = "US")
{
	if(appids instanceof Array)
		appids = appids.join(",");

	const res = await fetch(`${BASE_PRICE_URL}${appids}&cc=${cc}`);
	const data = await res.json();
	for(const appid in data)
		data[appid] = data[appid].data?.price_overview;
	return data;
}


/**
 * Returns details about an app.
 * @param {number} appid The app's id.
 * @param {string} lang (optional) The language to get the details in. Default: en
 * @returns {Promise<object?>} The app's details, or null if it doesn't exist.
 */
export async function getDetails(appid, lang = "en", cc = "US")
{
	const res = await fetch(`${BASE_DETAILS_URL}${appid}&cc=${cc}`, {
		headers: {
			"Accept-Language": lang === "en" ? "en" : `${lang}, en`,
		},
	});
	const { [appid]: details } = await res.json();
	return details.success ? details.data : null;
}

/**
 * Checks if the given app is NSFW.
 * @param {object} appDetails The app's details.
 * @returns {boolean}
 */
export function isNSFW({ required_age, content_descriptors })
{
	const notes = content_descriptors.notes?.toLowerCase();
	return required_age >= 18 || notes && (notes.includes("nudity") || notes.includes("sex"));
}
