
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
 * @param {object[]|FieldList} embeds The embeds
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


/**
 * This class allows having groups of fields sprawl over several embeds.
 * It is, fundamentally, an array of embeds.
 */
export class FieldList extends Array
{
	/**
	 * Add a group of fields to the list.
	 * @param {{name:string, value:string}} fields The fields to add
	 * @param {object} [props] Additional properties for the embed.
	   * @param {string} [props.title] Title to give to this group of fields
	   * @param {string} [props.description] Description to give to this group of fields
	   * @param {number} [props.color] Color for the embeds
	 * @returns The new length of the field list
	 */
	addGroup(fields, { title, description, color } = {}) {
		if(!fields?.length)
			return;

		for(const field of fields)
			if(field.value.length > FIELD_LENGTH_LIMIT)
				field.value = `${field.value.slice(0, FIELD_LENGTH_LIMIT-3)}…`;

		const firstOfGroup = this.length;
		for(let i = 0 ; i < fields.length ; i += FIELDS_PER_EMBED)
			this.push({fields: fields.slice(i, i + FIELDS_PER_EMBED), color});
		this[firstOfGroup].title = title;
		this[firstOfGroup].description = description;
		return this.length;
	}
}