"use strict";

const { getWatchedApps } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = "Affiche les jeux suivis dans ce serveur.";
exports.options = [];
exports.run = inter => {
	const watched = getWatchedApps(inter.guild.id);
	if(!watched.length)
		return inter.reply({ content: "Aucun jeu n'est suivi dans ce serveur.", ephemeral: true }).catch(error);

	inter.reply({ embeds: [{
		title: `Jeux suivis dans ${inter.guild}`,
		description: watched.length === 1 ? "1 jeu suivi" : `${watched.length} jeux suivis`,
		fields: watched.map(({appid, nsfw, name, channelId}) => ({ name, value: `Id : ${appid}\nNSFW: ${nsfw ? "Oui" : "Non"}\nSalon : <#${channelId}>`, inline: true })),
	}],
		ephemeral: true,
	}).catch(error);
}
