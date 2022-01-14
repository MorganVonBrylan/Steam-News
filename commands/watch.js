"use strict";

const { getDetails, isNSFW } = require("../steam_news/api");
const { WATCH_LIMIT, watch, unwatch, purgeApp } = require("../steam_news/watchers");

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
	const defer = inter.deferReply({ephemeral: true}).catch(error);
	const appid = inter.options.getInteger("id");
	let details = getDetails(appid);
	watch(appid, channel).then(async success => {
		await defer;
		details = await details;

		if(details.type === "dlc")
		{
			purgeApp(appid);
			return inter.editReply({content: "DLCs do not have a news feed.", ephemeral: true}).catch(error);
		}

		if(isNSFW(details) && !channel.nsfw)
		{
			unwatch(appid, inter.guild);
			return inter.editReply("This game has adult content. You can only display its news in a NSFW channel.").catch(error);
		}

		inter.editReply({ content:
			success ? `${details.name}’s news will now be sent into ${channel}.${success === WATCH_LIMIT ? `\nWarning: you reached your ${WATCH_LIMIT} games per server limit.` : ""}`
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
