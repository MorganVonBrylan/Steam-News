"use strict";

const { getWatchedApps, getWatchedPrices } = require("../steam_news/watchers");

exports.options = [];
exports.run = inter => {
	const t = tr.set(inter.locale, "watched");
	const watched = getWatchedApps(inter.guild.id);
	const watchedPrices = getWatchedPrices(inter.guild.id);

	const embeds = [];
	if(watched.length)
		embeds.push({
			title: t("games-watched", inter.guild),
			description: tr.plural("games", watched.length),
			fields: watched.map(gameToField),
		});

	if(watchedPrices.length)
		embeds.push({
			title: t("prices-watched", inter.guild),
			description: tr.plural("prices", watchedPrices.length),
			fields: watchedPrices.map(gameToField),
		});

	inter.reply(embeds.length
		? { ephemeral: true, embeds }
		: { ephemeral: true, content: t("none") }
	).catch(error);
}


function gameToField({appid, nsfw, name, channelId}) {
	return { name, value: `${tr.t("id", appid)}\n${tr.t(`NSFW-${nsfw ? "yes" : "no"}`)}\n${tr.t("channel", `<#${channelId}>`)}`, inline: true };
}
