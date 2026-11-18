
import { PermissionFlagsBits as PERMISSIONS } from "discord.js";
export const REQUIRED_PERMS = PERMISSIONS.ViewChannel | PERMISSIONS.SendMessages | PERMISSIONS.EmbedLinks;
export const REQUIRED_THREAD_PERMS = PERMISSIONS.ViewChannel | PERMISSIONS.SendMessagesInThreads | PERMISSIONS.EmbedLinks;

/** @import {Embed} from "discord.js" */

export const MAX_FIELDS_PER_EMBED = 25;
/** Divisible by 3; avoids having one lonely entry at the bottom when all fields are inline */
export const MAX_FIELDS_PER_EMBED_NICE_INLINES = 24;
export const FIELD_LENGTH_LIMIT = 1024;
export const EMBEDS_PER_MESSAGE = 10;

/**
 * Count the total number of fields in an embed list
 * @param {Embed[]} embeds The embeds
 * @param {number} countNoneAs How many fields should field-less embeds count as. Defaults to 0.
 */
export function countFields(embeds, countNoneAs = 0)
{
	return embeds.reduce((count, embed) => count + (embed.fields?.length || countNoneAs), 0);
}


/**
 * This class allows having groups of fields sprawl over several embeds.
 * It is, fundamentally, an array of embeds.
 * @extends Array<Embed>
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
	 * @param {boolean} atBeginning Whether to prepend that group to the field list rather than appending it
	 * @returns The new length of the field list
	 */
	addGroup(fields, { title, description, color } = {}, atBeginning = false) {
		if(!fields?.length)
			return;

		let MAX_FIELDS = MAX_FIELDS_PER_EMBED_NICE_INLINES;
		for(const field of fields)
		{
			if(!field.inline)
				MAX_FIELDS = MAX_FIELDS_PER_EMBED;
			if(field.value.length > FIELD_LENGTH_LIMIT)
				field.value = `${field.value.slice(0, FIELD_LENGTH_LIMIT-3)}…`;
		}

		const group = [{
			title, description, color,
			fields: fields.slice(0, MAX_FIELDS),
		}];
		for(let i = MAX_FIELDS ; i < fields.length ; i += MAX_FIELDS)
			group.push({fields: fields.slice(i, i + MAX_FIELDS), color});

		if(atBeginning) this.unshift(...group);
		else this.push(...group);

		return this.length;
	}
}