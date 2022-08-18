"use strict";

const { getAppName } = require("./watchers");
const STEAM_CLAN_IMAGE = "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/clans";
const YT_REGEX = /\[previewyoutube=([\w-]+)/;
const YT_REGEX_G = /\[previewyoutube=([\w-]+)(;full)?\]\[\/previewyoutube\]/g;

const { francophones } = require("../locales.json");

/**
 * Returns the given Steam news item as a Discord embed.
 * @param {object} newsitem The news item.
 * @returns {object} A Discord embed.
 */
module.exports = exports = ({appid, url, title, contents, feedlabel, date}) => {
	const image = contents.match(/({STEAM_CLAN_IMAGE})[^\[]+/);
	const yt = contents.match(YT_REGEX_G)?.map(match => `https://youtu.be/${YT_REGEX.exec(match)[1]}`).join("\n");
	const name = getAppName(appid);
	return {
		url,
		image: image ? {url: image[0].replace("{STEAM_CLAN_IMAGE}", STEAM_CLAN_IMAGE)} : undefined,
		title,
		description: toMarkdown(contents),
		yt,
		author: name ? { name, url: "https://store.steampowered.com/app/"+appid } : undefined,
		footer: name ? { text: name } : undefined,
		timestamp: date * 1000,
	};
};

function toMarkdown(contents, limit = 2000)
{
	contents = contents
		.replaceAll(/{STEAM_CLAN_IMAGE}[^\[]+/g, "")
		.replaceAll(YT_REGEX_G, "")
		.replaceAll(/\[url=(http[^\]]+)\]([^\[]+)\[\/url\]/g, "[$2]($1)")
		.replaceAll(/\[url=(http[^\]]+)\]\[\/url\]/g, "")
		.replaceAll(/\n+(\[\/[^\]]+\])/g, "$1")
		.replaceAll(/\[\/?(b|h[0-9])\]/g, "**")
		.replaceAll(/\[\/?i\]/g, "*")
		.replaceAll(/\[\/?u\]/g, "__")
		.replaceAll(/\[\/?s\]/g, "~~")
		.replaceAll(/\[\/?i\]/g, "*")
		.replaceAll(/\[\/?(img|list)\]/g, "")
		.replaceAll(/\[\*\]/g, "–")
		.replaceAll(/\n{2,}/g, "\n")
		.replaceAll("\n**", "\n\n**");

	return contents.length < limit ? contents : `${contents.substring(0, limit-1)}…`;

}


/**
 * Returns the given price_overview as a Discord embed
 * @param {int} appid The app's id
 * @param {string} name The app's name
 * @param {object} price A price_overview object, with a cc property (country code)
 */
exports.price = (appid, name, price) => {
	const fr = francophones.includes(price.cc);
	return {
		url: "https://store.steampowered.com/app/"+appid,
		title: name,
		description: price.discount_percent
			? `${fr ? "En solde !" : "On sale!"} ~~${price.initial_formatted}~~ **${price.final_formatted}** (-${price.discount_percent}%)`
			: `${fr ? "Le jeu est sorti ! Il est à" : "The game is out! It costs"} **${price.final_formatted}**`,
		fields: [{name: fr ? "Ouvrir dans l’appli" : "Open in app", value: "steam://store/"+appid}],
	};
}
