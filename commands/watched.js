"use strict";

const { getWatchedApps, getWatchedPrices } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = "See what games are being watched in that server.";
exports.options = [];
exports.run = inter => {
	const watched = getWatchedApps(inter.guild.id);
	const watchedPrices = getWatchedPrices(inter.guild.id);

	const embeds = [];
	if(watched.length)
		embeds.push({
			title: `Games watched in ${inter.guild}`,
			description: watched.length === 1 ? "1 game watched" : `${watched.length} games watched`,
			fields: watched.map(gameToField),
		});

	if(watchedPrices.length)
		embeds.push({
			title: `Prices watched in ${inter.guild}`,
			description: watchedPrices.length === 1 ? "1 price watched" : `${watchedPrices.length} prices watched`,
			fields: watchedPrices.map(gameToField),
		});

	inter.reply(embeds.length
		? {ephemeral: true, embeds}
		: {ephemeral: true, content: "No game is watched in this server."}
	).catch(error);
}


function gameToField({appid, nsfw, name, channelId}) {
	return { name, value: `Id: ${appid}\nNSFW: ${nsfw ? "Yes" : "No"}\nChannel: <#${channelId}>`, inline: true };
}
