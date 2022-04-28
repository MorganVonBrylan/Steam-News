"use strict";

const { search, isNSFW } = require("../steam_news/api");
const { WATCH_LIMIT, watch, watchPrice, unwatch, getAppInfo, purgeApp } = require("../steam_news/watchers");
const { SEND_MESSAGES, EMBED_LINKS } = require("discord.js").Permissions.FLAGS;

const updateUnwatch = require("./guild").updateCmd.bind(null, require("./guild/unwatch"));

exports.defaultPermission = false;
exports.autocomplete = require("../autocomplete/search");
exports.description = `(admins only) Follow a game’s news feed or price changes (maximum ${WATCH_LIMIT} of each per server)`;
exports.options = [{
	type: "STRING", name: "type", required: true,
	description: "Whether to watch news or price changes",
	choices: [{name: "News", value: "news"}, {name: "Price", value: "price"}],
}, {
	type: "STRING", name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}, {
	type: "CHANNEL", name: "channel",
	channelTypes: ["GUILD_TEXT", "GUILD_PUBLIC_THREAD", "GUILD_PRIVATE_THREAD", "GUILD_NEWS", "GUILD_NEWS_THREAD"],
	description: "The channel where to send the news (defaults to current channel if not provided)"
}];
exports.run = async inter => {
	const channel = inter.options.getChannel("channel") || inter.channel;
	const perms = channel.permissionsFor(inter.guild.me);
	if(!perms.has(SEND_MESSAGES))
		return inter.reply({ephemeral: true, content: `I cannot send messages in ${channel}.`}).catch(error);
	else if(!perms.has(EMBED_LINKS))
		return inter.reply({ephemeral: true, content: `I cannot send embeds in ${channel}.`}).catch(error);

	const defer = inter.deferReply({ephemeral: true}).catch(error);
	let appid = inter.options.getString("game");

	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return defer.then(() => inter.editReply({ephemeral: true, content: `No game matching "${appid}" found.`}).catch(error));
	}

	const watchPrice = inter.options.getString("type") === "price";

	watch(+appid, channel, watchPrice).then(async success => {
		await defer;
		const details = getAppInfo(appid);

		if(!details)
		{
			purgeApp(appid);
			return inter.editReply({ephemeral: true, content: "The id you provided does not belong to any Steam app."}).catch(error);
		}

		if(watchPrice && success === null)
			return inter.editReply({ephemeral: true, content: "This game is free!"}).catch(error);

		if(details.type === "dlc" && !watchPrice)
		{
			purgeApp(appid);
			return inter.editReply({ephemeral: true, content: "DLCs do not have a news feed."}).catch(error);
		}

		if(details.nsfw && !channel.nsfw)
		{
			unwatch(appid, inter.guild);
			return inter.editReply(`This game has adult content. You can only display its ${watchPrice ? "price" : "news"} in a NSFW channel.`).catch(error);
		}

		const limitWarning = success === WATCH_LIMIT ? `\nWarning: you reached your ${WATCH_LIMIT} games per server limit.` : "";
		const detailsError = details.name === "undefined" ? "\nHowever, an error occurred while trying to get the app's details. It may be called “undefined” for a while." : "";

		updateUnwatch(inter.guild, true);

		inter.editReply({ephemeral: true, content:
			success ? `${details.name}’s ${watchPrice ? "price updates" : "news"} will now be sent into ${channel}.${detailsError}${limitWarning}`
				: `${details.name}’s ${watchPrice ? "price" : "news feed"} was already watched in that server.`,
		}).catch(error);
	}, async err => {
		await defer;
		if(err.message.includes("appid"))
			inter.editReply({ephemeral: true, content: "The id you provided does not belong to any Steam app."}).catch(error);
		else if(err instanceof RangeError)
			inter.editReply({ephemeral: true, content: err.message}).catch(error);
		else
		{
			error(err);
			inter.editReply({ephemeral: true, content: "An error occurred."}).catch(error);
		}
	});
}
