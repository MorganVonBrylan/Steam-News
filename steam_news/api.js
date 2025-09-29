
import { parseStringPromise as parseXML } from "xml2js";

// Example: view-source:https://store.steampowered.com/feeds/news/app/593110?l=japanese
const NEWS_URL = "https://store.steampowered.com/feeds/news/app/";
// Steam Store API unofficial doc: https://wiki.teamfortress.com/wiki/User:RJackson/StorefrontAPI
const STORE_BASE_URL = "https://store.steampowered.com/api/";
const BASE_DETAILS_URL = `${STORE_BASE_URL}appdetails?appids=`;
const BASE_PRICE_URL = `${STORE_BASE_URL}appdetails?filters=price_overview&appids=`;
const BASE_SEARCH_URL = `${STORE_BASE_URL}storesearch/?l=english`;

export const STEAM_APPID = 593110;
export const STEAM_ICON = "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/593110/403da5dab6ce5ea2882dc5b7636d7c4dbb73c81a.jpg";


export class HTTPError extends Error {
	constructor({url, code, statusText}) {
		super(`Query ended with code ${code}`);
		this.url = url;
		this.code = code;
		this.status = statusText;
	}
}

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
	else if(res.ok)
		throw new Error("Query did not return JSON");
	else if(status !== 504) // Gateway Timeout
		throw new HTTPError(res);
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
 * @param {string} language (optional) a Steam API language (see https://partner.steamgames.com/doc/store/localization/languages).
 *
 * @returns {Promise<object|null>} The news, or null if 
 */
export async function query(appid, language)
{
	if(!appid) throw new TypeError("appid cannot be null");
	let url = NEWS_URL + appid;
	if(language) url += `?l=${language}`;

	const response = await fetch(url);
	if(!response.ok)
		return { appid, error: `${response.status} ${response.statusText}` };
	
	const { rss } = await response.text().then(parseXML);
	const items = rss.channel[0].item || [];

	return { appid, newsitems: items.map(item => ({
		appid,
		eventId: item.link[0].substring(item.link[0].lastIndexOf("/") + 1),
		url: item.link[0],
		title: item.title[0],
		thumbnail: item.enclosure?.[0].$.url,
		contents: item.description[0],
		date: item.pubDate[0],
	}))};
}

/**
 * Queries the Steam API to get the latest Steam news.
 * @param {string} language (optional) a Steam API language (see https://partner.steamgames.com/doc/store/localization/languages).
 * @returns {Promise<object>} The news
 */
export const querySteam = query.bind(null, STEAM_APPID);


/**
 * Helper function to know if an appid is valid or not.
 * @param {number} appid The app's id.
 * @returns {Promise<boolean>} true or false
 */
export async function exists(appid)
{
	const appnews = await fetch(NEWS_URL+appid, {method: "HEAD"});
	return appnews.ok;
}


const BULK_LIMIT = 250;
/**
 * Queries prices for one or more apps.
 * @param {number|Array<number>} appids The app id(s)
 * @param {string} cc The country code for the price (e.g. "FR", "UK", etc). Default: "US"
 * @returns {Promise<object>} A promise resolving to a dictionary of appid => price_overview pairs.
 */
export async function queryPrices(appids, cc = "US")
{
	if(appids instanceof Array)
	{
		const groups = [];
		for(let i = 0 ; i < appids.length ; i += BULK_LIMIT)
			groups.push(appids.slice(i, i + BULK_LIMIT).join(","));
		appids = groups;
	}
	else
		appids = [appids];

	const prices = {};
	for(const group of appids)
	{
		const data = await fetch(`${BASE_PRICE_URL}${group}&cc=${cc}`).then(handleQuery);
		for(const appid in data)
			prices[appid] = data[appid].data?.price_overview;
	}
	return prices;
}


/**
 * Returns details about an app.
 * @param {number} appid The app's id.
 * @param {string} lang (optional) The language to get the details in. Default: en
 * @param {string} cc (optional) The country to get the details for. Mostly for prices. Default: US
 * @returns {Promise<object?>} The app's details, or null if it doesn't exist.
 */
export async function getDetails(appid, lang = "en", cc = "US")
{
	const res = await fetch(`${BASE_DETAILS_URL}${appid}&cc=${cc}`, {
		headers: {
			"Accept-Language": lang === "en" ? "en" : `${lang}, en`,
		},
	}).then(handleQuery);
	const { [appid]: details } = res;
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
