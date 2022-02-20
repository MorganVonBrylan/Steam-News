"use strict";

const { search, query, getDetails, isNSFW } = require("../steam_news/api");
const { isKnown, saveAppInfo, isNSFW: isAppNSFW } = require("../steam_news/watchers");
const toEmbed = require("../steam_news/toEmbed.function");

exports.description = "See a game’s latest news.";
exports.options = [{
	type: "STRING", name: "name", required: true,
	description: "The game’s name or id",
}];
exports.run = async inter => {
	const defer = inter.deferReply().catch(error);
	let appid = inter.options.getString("name");
	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return defer.then(() => inter.editReply(`No game matching "${appid}" found.`).catch(error));
	}

	const fetchInfo = isKnown(appid) ? null : getDetails(appid);
	const {appnews} = await query(appid, 3);
	await defer;
	if(!appnews)
		return inter.editReply({content: "The id you provided does not belong to any Steam app."}).catch(error);

	if(fetchInfo)
	{
		const details = await fetchInfo;
		if(details.type === "dlc")
			return inter.editRreply({content: "DLCs do not have a news feed.", ephemeral: true}).catch(error);

		saveAppInfo(appid, { name: details.name, nsfw: isNSFW(details) });
	}

	if(!appnews.newsitems.length)
		return inter.editReply({content: "This app has no news.", ephemeral: true}).catch(error);

	let news;
	const reply = inter.editReply(isAppNSFW(appid) && !inter.channel.nsfw
		? { content: "This game has adult content. You can only display its news in a NSFW channel.", ephemeral: true }
		: { embeds: [news = toEmbed(appnews.newsitems[0])] }
	).catch(error);

	if(news?.yt)
		reply.then(() => inter.channel.send(news.yt).catch(error));
}
