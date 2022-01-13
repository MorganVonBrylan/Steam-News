"use strict";

const { query, getDetails, isNSFW } = require("../steam_news/api");
const { isKnown, saveAppInfo, isNSFW: isAppNSFW } = require("../steam_news/watchers");
const toEmbed = require("../steam_news/toEmbed.function");

exports.description = "Voir la dernière actu d'un jeu";
exports.options = [{
	type: "INTEGER", name: "id",
	description: "L'id du jeu", required: true
}];
exports.run = inter => {
	const appid = inter.options.getInteger("id");
	const fetchInfo = isKnown(appid) ? null : getDetails(appid);
	query(appid, 1).then(async ({appnews}) => {
		if(!appnews)
			return inter.reply({content: "L'id que vous avez fourni ne correspond à aucune appli Steam.", ephemeral: true}).catch(error);

		if(fetchInfo)
		{
			const details = await fetchInfo;
			if(details.type === "dlc")
				return inter.reply({content: "Les DLC n'ont pas d'actus.", ephemeral: true}).catch(error);

			saveAppInfo(appid, { name: details.name, nsfw: isNSFW(details) });
		}

		if(!appnews.newsitems.length)
			return inter.reply({content: "Cette application n'a aucune actu.", ephemeral: true}).catch(error);

		const [news] = appnews.newsitems;
		inter.reply(isAppNSFW(appid) && !inter.channel.nsfw
			? { content: "Ce jeu a du contenu adulte. Vous ne pouvez afficher ses actus que dans un salon NSFW.", ephemeral: true }
			: { embeds: [toEmbed(news)] }
		).catch(error);
	})
}
