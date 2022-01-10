"use strict";

const { query, isSteamNews } = require("../steam_news/api");
const toEmbed = require("../steam_news/toEmbed.function");

exports.description = "Voir la dernière actu d'un jeu";
exports.options = [{
	type: "INTEGER", name: "id",
	description: "L'id du jeu", required: true
}];
exports.run = inter => {
	query(inter.options.getInteger("id"), 10).then(({appnews}) => {
		if(!appnews)
			return inter.reply({content: "L'id que vous avez fourni ne correspond à aucune appli Steam.", ephemeral: true}).catch(error);
		if(!appnews.newsitems.length)
			return inter.reply({content: "Cette application n'a aucune actu.", ephemeral: true}).catch(error);

		for(const news of appnews.newsitems)
			if(isSteamNews(news))
				return inter.reply({ embeds: [toEmbed(news)] }).catch(error);

		inter.reply({content: "Cette application n'a aucune actu récente.", ephemeral: true}).catch(error);
	})
}
