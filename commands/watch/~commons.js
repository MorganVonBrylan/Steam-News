
import { PermissionFlagsBits } from "discord.js";
const {
	ViewChannel: VIEW_CHANNEL,
	SendMessages: SEND_MESSAGES,
	SendMessagesInThreads: SEND_MESSAGES_IN_THREADS,
	EmbedLinks: EMBED_LINKS,
} = PermissionFlagsBits;

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