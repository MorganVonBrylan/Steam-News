"use strict";

const { search, query, getDetails, isNSFW } = require("../steam_news/api");
const { isKnown, saveAppInfo, isNSFW: isAppNSFW } = require("../steam_news/watchers");
const toEmbed = require("../steam_news/toEmbed.function");

exports.global = true;
exports.autocomplete = require("../autocomplete/search");
exports.description = "See a game’s latest news.";
exports.options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
exports.run = async inter => {
	const defer = inter.deferReply().catch(error);
	let appid = inter.options.getString("game");
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
			return inter.editRreply({ephemeral: true, content: "DLCs do not have a news feed."}).catch(error);

		saveAppInfo(appid, { name: details.name, nsfw: +isNSFW(details) });
	}

	if(!appnews.newsitems.length)
		return inter.editReply({ephemeral: true, content: "This app has no news."}).catch(error);

	let news;
	const reply = inter.editReply(isAppNSFW(appid) && !inter.channel.nsfw
		? { ephemeral: true, content: "This game has adult content. You can only display its news in a NSFW channel." }
		: { embeds: [news = toEmbed(appnews.newsitems[0])] }
	).catch(error);

	if(news?.yt)
		reply.then(() => inter.channel.send(news.yt).catch(error));
}
