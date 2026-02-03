
import { getAppName } from "./watchers.js";
import { steamAppLink, banner, icon } from "./api.js";
const STEAM_CLAN_IMAGE = "https://clan.akamai.steamstatic.com/images";
const YT_REGEX = /data-youtube="([\w-]+)"/g;

import locales from "../localization/locales.js";
const { countryToLang } = locales;

import { NodeHtmlMarkdown } from "node-html-markdown";
const nhm = new NodeHtmlMarkdown({ maxConsecutiveNewlines: 2 });
const html2markdown = nhm.translate.bind(nhm);

/**
 * Returns the given Steam news item as a Discord embed.
 * @param {object} newsitem The news item.
 * @param {string} lang The language (default: en)
 * @returns {Promise<object>} A Discord embed.
 */
export default async function toEmbed({ appid, url, title, thumbnail, contents, date }, lang = "en")
{
	const eventId = url.substring(url.lastIndexOf("/") + 1);
	thumbnail ??= contents.match(/<img src="(https[^"]+)"/)?.[1];
	const yt = contents.match(YT_REGEX)?.map(m => `https://youtu.be/${m.slice(14, -1)}`).join("\n");
	const name = getAppName(appid);
	const iconURL = await icon(appid, false);
	const steamLink = `url/EventAnnouncementPage/${appid}/${eventId}`;
	return {
		url,
		image: thumbnail ? { url: thumbnail } : undefined,
		title,
		description: toMarkdown(contents),
		fields: [{name: tr.get(lang, "info.openInApp"), value: steamAppLink(steamLink, lang) }],
		yt,
		author: name ? { name, url: "https://store.steampowered.com/app/"+appid } : undefined,
		footer: name || iconURL ? { text: name, iconURL } : undefined,
		timestamp: new Date(date).toISOString(),
	};
};

function toMarkdown(contents, limit = 2000)
{
	contents = contents.replaceAll(/<div class="bb_h([0-9])">(.+?)<\/div>/g, "<h$1>$2</h$1>");
	contents = html2markdown(contents)
		.replaceAll(/!\[\]\([^)]+\)/g, "") // e.g. ![](https://whtv.com/some_image.gif)
		.replaceAll("\\[carousel\\]\\[/carousel\\]", "[carousel]")
		.replaceAll(/(\n *){3,}/g, "\n\n")
		.trim();

	return contents.length < limit ? contents : `${contents.substring(0, limit-1)}…`;
}


/**
 * Returns the given price_overview as a Discord embed
 * @param {number} appid The app's id
 * @param {string} name The app's name
 * @param {object} price A price_overview object, with a cc property (country code)
 * 
 * @returns {Promise<object>} A Discord embed.
 */
export async function price(appid, name, price)
{
	const t = tr.get(countryToLang[price.cc], "price");
	return {
		url: "https://store.steampowered.com/app/"+appid,
		title: name,
		description: price.discount_percent
			? `${t.sale} ~~${price.initial_formatted}~~ **${price.final_formatted}** (-${price.discount_percent}%)`
			: t.published.replace("%s", price.final_formatted),
		fields: [{name: t.openInApp, value: steamAppLink("steam://store/"+appid)}],
		image: { url: await banner(appid, banner.SMALL) },
	};
}
