"use strict";

const { getWatchedApps, getWatchedPrices } = require("../steam_news/watchers");
const { stmts: {isWatchingSteam} } = require("../steam_news/db");

exports.options = [];
exports.run = inter => {
	const t = tr.set(inter.locale, "watched");
	const { guild } = inter;
	const watched = getWatchedApps(guild.id);
	const watchedPrices = getWatchedPrices(guild.id);

	const embeds = [
		...split(watched, t("games-watched", guild), tr.plural("games", watched.length)),
		...split(watchedPrices, t("prices-watched", guild), tr.plural("prices", watchedPrices.length)),
	];

	const steamWatch = isWatchingSteam(guild.id);
	if(steamWatch)
		embeds.push({ description: t("steam-watched", `<#${steamWatch}>`) });

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
