"use strict";

const { search, query, getDetails, isNSFW } = require("../steam_news/api");
const { isKnown, saveAppInfo, isNSFW: isAppNSFW } = require("../steam_news/watchers");
const toEmbed = require("../steam_news/toEmbed.function");

const { PermissionsBitField: {Flags: {SendMessages: SEND_MESSAGES}} } = require("discord.js");

exports.dmPermission = true;
exports.autocomplete = require("../autocomplete/search");
exports.options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
exports.run = async inter => {
	const defer = inter.deferReply().catch(error);
	let t = tr.set(inter.locale);
	let appid = inter.options.getString("game");
	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return defer.then(() => inter.editReply(t("no-match", appid)).catch(error));
	}

	const fetchInfo = isKnown(appid) ? null : getDetails(appid);
	const {appnews} = await query(appid, 1);
	await defer;
	if(!appnews)
		return inter.editReply({content: t("bad-appid")}).catch(error);

	if(fetchInfo)
	{
		const details = await fetchInfo;
		if(details.type === "dlc")
			return inter.editReply({ephemeral: true, content: t("no-DLC-news")}).catch(error);

		saveAppInfo(appid, { name: details.name, nsfw: +isNSFW(details) });
	}

	if(!appnews.newsitems.length)
		return inter.editReply({ephemeral: true, content: t("no-news")}).catch(error);

	let news;
	const reply = inter.editReply(isAppNSFW(appid) && !inter.channel.nsfw
		? { ephemeral: true, content: t("NSFW-content-news") }
		: { embeds: [news = await toEmbed(appnews.newsitems[0], inter.locale)] }
	).catch(error);

	if(news?.yt && inter.channel.permissionsFor(await inter.guild.members.fetchMe())?.has(SEND_MESSAGES))
		reply.then(() => inter.channel.send(news.yt).catch(error));
}
