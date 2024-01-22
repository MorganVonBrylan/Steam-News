"use strict";

const { getAppName } = require("./watchers");
const { getEventId, steamAppLink } = require("./api");
const STEAM_CLAN_IMAGE = "https://clan.akamai.steamstatic.com/images";
const YT_REGEX = /\[previewyoutube=([\w-]+)/;
const YT_REGEX_G = /\[previewyoutube=([\w-]+)(;full)?\]\[\/previewyoutube\]/g;

const { countryToLang } = require("../locales.json");

/**
 * Returns the given Steam news item as a Discord embed.
 * @param {object} newsitem The news item.
 * @param {string} lang The language (default: en)
 * @returns {object} A Discord embed.
 */
module.exports = exports = async ({ appid, eventId, url, title, contents, date }, lang = "en") => {
	if(!eventId) eventId = getEventId({url});
	const image = contents.match(/({STEAM_CLAN_IMAGE})[^\[ ]+/);
	const yt = contents.match(YT_REGEX_G)?.map(match => `https://youtu.be/${YT_REGEX.exec(match)[1]}`).join("\n");
	const name = getAppName(appid);
	const steamLink = `url/EventAnnouncementPage/${appid}/${await eventId}`;
	return {
		url,
		image: image ? {url: image[0].replace("{STEAM_CLAN_IMAGE}", STEAM_CLAN_IMAGE)} : undefined,
		title,
		description: toMarkdown(contents).replaceAll("##table##", `\`[${tr.get(lang, "table")}]\``),
		fields: [{name: tr.get(lang, "info.openInApp"), value: steamAppLink(steamLink, lang) }],
		yt,
		author: name ? { name, url: "https://store.steampowered.com/app/"+appid } : undefined,
		footer: name ? { text: name } : undefined,
		timestamp: new Date(date * 1000).toISOString(),
	};
};

function toMarkdown(contents, limit = 2000)
{
	contents = contents
		.replaceAll(/{STEAM_CLAN_IMAGE}[^\[]+/g, "")
		.replaceAll(YT_REGEX_G, "")
		.replaceAll(/\[table\].*?\[\/table\]/gs, "##table##")
		.replaceAll(/\[url=(http[^\]]+)\]([^\[]+)\[\/url\]/g, "$1")
		.replaceAll(/\[url=(http[^\]]+)\]\[\/url\]/g, "")
		.replaceAll("[hr][/hr]", "——————————")
		.replaceAll("&nbsp;", " ")
		.replaceAll(/\n+(\[\/[^\]]+\])/g, "$1")
		.replaceAll(/\[\/?(b|h[0-9])\]/g, "**")
		.replaceAll(/\[\/?i\]/g, "*")
		.replaceAll(/\[\/?u\]/g, "__")
		.replaceAll(/\[\/?s\]/g, "~~")
		.replaceAll(/\[\/?(img|list)\]/g, "")
		.replaceAll(/\[\*\]/g, "- ")
		.replaceAll(/\n{2,}/g, "\n")
		.replaceAll(/\[\/?[a-z]+\]/g, "")
		.replaceAll("\n**", "\n\n**");

	return contents.length < limit ? contents : `${contents.substring(0, limit-1)}…`;
}


/**
 * Returns the given price_overview as a Discord embed
 * @param {number} appid The app's id
 * @param {string} name The app's name
 * @param {object} price A price_overview object, with a cc property (country code)
 * 
 * @returns {object} A Discord embed.
 */
exports.price = (appid, name, price) => {
	const t = tr.get(countryToLang[price.cc], "price");
	return {
		url: "https://store.steampowered.com/app/"+appid,
		title: name,
		description: price.discount_percent
			? `${t.sale} ~~${price.initial_formatted}~~ **${price.final_formatted}** (-${price.discount_percent}%)`
			: t.published.replace("%s", price.final_formatted),
		fields: [{name: t.openInApp, value: steamAppLink("steam://store/"+appid)}],
	};
}
