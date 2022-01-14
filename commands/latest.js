"use strict";

const { query, getDetails, isNSFW } = require("../steam_news/api");
const { isKnown, saveAppInfo, isNSFW: isAppNSFW } = require("../steam_news/watchers");
const toEmbed = require("../steam_news/toEmbed.function");

exports.description = "See a game’s latest news.";
exports.options = [{
	type: "INTEGER", name: "id", required: true,
	description: "The game’s id",
}];
exports.run = inter => {
	const appid = inter.options.getInteger("id");
	const fetchInfo = isKnown(appid) ? null : getDetails(appid);
	query(appid, 1).then(async ({appnews}) => {
		if(!appnews)
			return inter.reply({content: "The id you provided does not belong to any Steam app.", ephemeral: true}).catch(error);

		if(fetchInfo)
		{
			const details = await fetchInfo;
			if(details.type === "dlc")
				return inter.reply({content: "DLCs do not have a news feed.", ephemeral: true}).catch(error);

			saveAppInfo(appid, { name: details.name, nsfw: isNSFW(details) });
		}

		if(!appnews.newsitems.length)
			return inter.reply({content: "This app has no news.", ephemeral: true}).catch(error);

		const [news] = appnews.newsitems;
		inter.reply(isAppNSFW(appid) && !inter.channel.nsfw
			? { content: "This game has adult content. You can only display its news in a NSFW channel.", ephemeral: true }
			: { embeds: [toEmbed(news)] }
		).catch(error);
	})
}
