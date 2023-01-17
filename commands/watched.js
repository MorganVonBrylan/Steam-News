"use strict";

const { getWatchedApps, getWatchedPrices } = require("../steam_news/watchers");

exports.options = [];
exports.run = inter => {
	const t = tr.set(inter.locale, "watched");
	const watched = getWatchedApps(inter.guild.id);
	const watchedPrices = getWatchedPrices(inter.guild.id);

	const embeds = [
		...split(watched, t("games-watched", inter.guild), tr.plural("games", watched.length)),
		...split(watchedPrices, t("prices-watched", inter.guild), tr.plural("prices", watchedPrices.length)),
	];

	inter.reply(embeds.length
		? { ephemeral: true, embeds }
		: { ephemeral: true, content: t("none") }
	).catch(error);
}


function split(watched, title, description, blockSize = 25)
{
	if(!watched.length) return [];
	const embeds = [];
	for(let i = 0 ; i < watched.length ; i += blockSize)
		embeds.push({fields: watched.slice(i, i + blockSize).map(gameToField)});

	Object.assign(embeds[0], { title, description });
	return embeds;
}

function gameToField({appid, nsfw, name, channelId}) {
	return { name, value: `${tr.t("id", appid)}\n${tr.t(`NSFW-${nsfw ? "yes" : "no"}`)}\n${tr.t("channel", `<#${channelId}>`)}`, inline: true };
}
