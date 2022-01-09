"use strict";

/**
 * Returns the given Steam news item as a Discord embed.
 * @param {object} newsitem The news item.
 * @returns {object} A Discord embed.
 */
module.exports = exports = newsitem => {
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
