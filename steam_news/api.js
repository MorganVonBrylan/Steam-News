"use strict";

const fetch = require("node-fetch");
const BASE_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=";
const STEAM_CLAN_IMAGE = "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/clans";

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

	return fetch(url).then(res => res.json());
}


/**
 * Returns the given Steam news item as a Discord embed.
 * @param {object} newsitem The news item.
 * @returns {object} A Discord embed.
 */
exports.toEmbed = newsitem => {
	const image = newsitem.contents.match(/{STEAM_CLAN_IMAGE}[^ ]+/);
	return {
		url: newsitem.url,
		image: image ? {url: image[0].replace("{STEAM_CLAN_IMAGE}", STEAM_CLAN_IMAGE)} : undefined,
		title: newsitem.title,
		description: htmlToMarkdown(newsitem.contents),
		author: { name: newsitem.author },
		footer: { text: newsitem.feedlabel },
		timestamp: newsitem.date * 1000,
	};
};

function htmlToMarkdown(html)
{
	return html
		.replaceAll(/{STEAM_CLAN_IMAGE}[^ ]+ /g, "")
		.replaceAll(/<a href="(http[^"]+)">([^<]+)<\/a>/g, "[$2]($1)");
}
