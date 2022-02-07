"use strict";

const { isNSFW } = require("../steam_news/api");
const { WATCH_LIMIT, watch, unwatch, getAppInfo, purgeApp } = require("../steam_news/watchers");
const { SEND_MESSAGES, EMBED_LINKS } = require("discord.js").Permissions.FLAGS;

exports.adminOnly = true;
exports.description = `(admins only) Follow a game’s news feed (maximum ${WATCH_LIMIT} games per server)`;
exports.options = [{
	type: "INTEGER", name: "id", required: true,
	description: "The game’s id",
}, {
	type: "CHANNEL", name: "channel",
	channelTypes: ["GUILD_TEXT", "GUILD_PUBLIC_THREAD", "GUILD_PRIVATE_THREAD", "GUILD_NEWS", "GUILD_NEWS_THREAD"],
	description: "The channel where to send the news (defaults to current channel if not provided)"
}];
exports.run = inter => {
	const channel = inter.options.getChannel("channel") || inter.channel;
	const perms = channel.permissionsFor(inter.guild.me);
	if(!perms.has(SEND_MESSAGES))
		return inter.reply({content: `I cannot send messages in ${channel}.`, ephemeral: true}).catch(error);
	else if(!perms.has(EMBED_LINKS))
		return inter.reply({content: `I cannot send embeds in ${channel}.`, ephemeral: true}).catch(error);

	const defer = inter.deferReply({ephemeral: true}).catch(error);
	const appid = inter.options.getInteger("id");
	watch(appid, channel).then(async success => {
		await defer;
		const details = getAppInfo(appid);

		if(!details)
		{
			purgeApp(appid);
			return inter.editReply({content: "The id you provided does not belong to any Steam app.", ephemeral: true}).catch(error);
		}

		if(details.type === "dlc")
		{
			purgeApp(appid);
			return inter.editReply({content: "DLCs do not have a news feed.", ephemeral: true}).catch(error);
		}

		if(details.nsfw && !channel.nsfw)
		{
			unwatch(appid, inter.guild);
			return inter.editReply("This game has adult content. You can only display its news in a NSFW channel.").catch(error);
		}

		const limitWarning = success === WATCH_LIMIT ? `\nWarning: you reached your ${WATCH_LIMIT} games per server limit.` : "";
		const detailsError = details.name === "undefined" ? "\nHowever, an error occurred while trying to get the app's details. It may be called “undefined” for a while." : "";

		inter.editReply({ content:
			success ? `${details.name}’s news will now be sent into ${channel}.${detailsError}${limitWarning}`
				: `${details.name}’s news feed was already watched in that server.`,
			ephemeral: true
		}).catch(error);
	}, async err => {
		await defer;
		if(err.message.includes("appid"))
			inter.editReply({ content: "The id you provided does not belong to any Steam app.", ephemeral: true }).catch(error);
		else if(err instanceof RangeError)
			inter.editReply({ content: `Error: Maximum number of games watched per server reached (${WATCH_LIMIT}).`, ephemeral: true }).catch(error);
		else
		{
			error(err);
			inter.editReply({ content: "An error occurred.", ephemeral: true }).catch(error);
		}
	});
}
