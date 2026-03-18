
import {
	ChatInputCommandInteraction,
	PermissionFlagsBits as PERMISSIONS,
	MessageFlagsBitField,
} from "discord.js";
export const REQUIRED_PERMS = PERMISSIONS.ViewChannel | PERMISSIONS.SendMessages | PERMISSIONS.EmbedLinks;
export const REQUIRED_THREAD_PERMS = PERMISSIONS.ViewChannel | PERMISSIONS.SendMessagesInThreads | PERMISSIONS.EmbedLinks;

const { Flags: { Ephemeral } } = MessageFlagsBitField;

const FIELDS_PER_EMBED = 25;
const FIELD_LENGTH_LIMIT = 1024;
const EMBEDS_PER_MESSAGE = 10;

/**
 * Send embeds to a channel or interaction while respecting the embed limit per message.
 * @param {object[]} embeds The embeds
 * @param {ChatInputCommandInteraction|import("./channels.js").GuildTextChannel} sender 
 * @param {import("discord.js").BitFieldResolvable} [flags]
 */
export async function sendEmbeds(embeds, sender, flags)
{
	function slice(start) {
		return { flags, embeds: embeds.slice(start, start + EMBEDS_PER_MESSAGE) };
	}

	if(sender instanceof ChatInputCommandInteraction)
	{
		if(sender.deferred || sender.replied)
			await sender.editReply(slice(0));
		else
			await sender.reply(slice(0));

		if(embeds.length > EMBEDS_PER_MESSAGE)
		{
			flags = MessageFlagsBitField.resolve(flags);
			const { channel } = sender;
			const canSend = !(flags & Ephemeral) && channel && (
				!channel.guild
				|| channel.permissionsFor(channel.guild.members.me)
					.has(channel.isThread() ? REQUIRED_THREAD_PERMS : REQUIRED_PERMS)
			);
			const send = canSend ? channel.send.bind(channel) : sender.followUp.bind(sender);
			for(let i = EMBEDS_PER_MESSAGE ; i < embeds.length ; i += EMBEDS_PER_MESSAGE)
				send(slice(i));
		}
	}
	else for(let i = 0 ; i < embeds.length ; i += EMBEDS_PER_MESSAGE)
		await sender.send(slice(i));
}
