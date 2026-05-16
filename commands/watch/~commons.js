
import { PermissionFlagsBits } from "discord.js";
const {
	ViewChannel: VIEW_CHANNEL,
	SendMessages: SEND_MESSAGES,
	SendMessagesInThreads: SEND_MESSAGES_IN_THREADS,
	EmbedLinks: EMBED_LINKS,
} = PermissionFlagsBits;

import { fetchThreads } from "../../utils/channels.js";
import { setWebhook } from "../../steam_news/db_api.js";


export const options = [{
	type: ROLE, name: "role",
	description: "A role to ping when news are posted",
}, {
	type: CHANNEL, name: "channel",
	channelTypes: ALL_TEXT_CHANNEL_TYPES,
	description: "The channel where to send the news (defaults to current channel if not provided)"
}];

/**
 * Checks whether the bot has the required permissions for sending news.
 * @param {import("discord.js").GuildChannel} channel 
 * @returns {string|undefined} The error preventing the bot from sending news, if any
 */
export async function checkPerms(channel)
{
	const perms = channel.permissionsFor(await channel.guild.members.fetchMe());
	if(!perms.has(VIEW_CHANNEL))
		return "cannot-see";
	else if(!perms?.has(channel.isThread() ? SEND_MESSAGES_IN_THREADS : SEND_MESSAGES))
		return "cannot-send";
	else if(!perms.has(EMBED_LINKS))
		return "cannot-embed";
}


/**
 * Update the webhook after the thread was changed.
 * @param {{appid:string, channelId:string, webhook:string}} oldWatcher The previous watcher data
 * @param {import("../../utils/channels.js").GuildTextChannel} channel The current watcher channel
 * @param {import("../../steam_news/db_api.js").WatcherType} type The watcher type
 * @returns {Promise<?boolean>} flase if no update was needed (the channel is the same, or there is no webhook), true if the webhook was updated, null if it had to be removed
 */
export async function updateWebhook({appid, channelId: oldChannel, webhook}, channel, type = "news")
{
	const { id: channelId } = channel;
	if(!webhook || oldChannel === channelId)
		return false;

	if(channel.isThread())
	{
		if(channel.parentId === oldChannel)
		{
			const separator = webhook.indexOf("#", 50);
			if(separator === -1)
				webhook += "#t";
			else
				webhook = `${webhook.slice(0, separator)}#t${webhook.slice(separator)}`;
		}
		else
		{
			const siblings = await fetchThreads(channel);
			if(!siblings.includes(oldChannel))
				webhook = null;
		}
	}
	else if((await fetchThreads(channel)).includes(oldChannel))
		webhook = webhook.replace("#t", "");
	else
		webhook = null;

	setWebhook(type, { appid, channelId, webhook });
	return webhook ? true : null;
}
