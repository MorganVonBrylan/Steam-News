"use strict";

const { getWatchedApps } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = "See what games are being watched in that server.";
exports.options = [];
exports.run = inter => {
	const watched = getWatchedApps(inter.guild.id);
	if(!watched.length)
		return inter.reply({ content: "No game is watched in this server.", ephemeral: true }).catch(error);

	inter.reply({ embeds: [{
		title: `Games watched in ${inter.guild}`,
		description: watched.length === 1 ? "1 game watched" : `${watched.length} games watched`,
		fields: watched.map(({appid, nsfw, name, channelId}) => ({ name, value: `Id: ${appid}\nNSFW: ${nsfw ? "Yes" : "Non"}\nChannel: <#${channelId}>`, inline: true })),
	}],
		ephemeral: true,
	}).catch(error);
}
