"use strict";

const { querySteam, STEAM_ICON } = require("../steam_news/api");
const toEmbed = require("../steam_news/toEmbed.function");

const { PermissionsBitField: {Flags: {SendMessages: SEND_MESSAGES}} } = require("discord.js");

exports.dmPermission = true;
exports.run = async inter => {
	const defer = inter.deferReply().catch(error);
	const {appnews} = await querySteam(1);
	await defer;

	const news = await toEmbed(appnews.newsitems[0], inter.locale);
	news.footer.iconUrl = STEAM_ICON;
	const reply = inter.editReply({ embeds: [news] }).catch(error);

	if(news.yt && inter.channel.permissionsFor(await inter.guild.members.fetchMe())?.has(SEND_MESSAGES))
		reply.then(() => inter.channel.send(news.yt).catch(error));
}
