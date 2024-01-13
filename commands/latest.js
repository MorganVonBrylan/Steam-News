"use strict";

const { query, getDetails, isNSFW } = require("../steam_news/api");
const interpretAppidOption = require("../interpretAppidOption.function");
const { isKnown, saveAppInfo, isNSFW: isAppNSFW } = require("../steam_news/watchers");
const toEmbed = require("../steam_news/toEmbed.function");

const { PermissionFlagsBits: { SendMessages: SEND_MESSAGES } } = require("discord.js");

exports.dmPermission = true;
exports.autocomplete = require("../autocomplete/search");
exports.options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
exports.run = async inter => {
	const { appid, defer } = await interpretAppidOption(inter);
	if(!appid)
		return;

	const t = tr.set(inter.locale);
	const fetchInfo = isKnown(appid) ? null : getDetails(appid);
	let info;
	try	{
		info = await query(appid, 1);
	}
	catch(e) {
		await defer;
		return inter.reply(e.message.includes("403")
			? "This app does not exist or is private."
			: "Error while fetching data from the Steam API. Please retry later.").catch(error);;
	}
	const { appnews } = info;
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

	if(news?.yt &&
		(!inter.guild || inter.channel?.permissionsFor(await inter.guild.members.fetchMe())?.has(SEND_MESSAGES)))
		reply.then(() => inter.channel.send(news.yt).catch(error));
}
