
import { client } from "../bot.js";
import { PermissionFlagsBits, ThreadChannel } from "discord.js";
import { purgeChannel, purgeGuild } from "../steam_news/db_api.js";
const { SendMessages: SEND_MESSAGES } = PermissionFlagsBits;

const recent = new Set();
export function fetchEntity(entity, force = null)
{
	if(recent.has(entity)) return entity;
	recent.add(entity);
	setTimeout(recent.delete.bind(recent, entity), 3600_000);
	return force === null ? entity.fetch() : entity.fetch(force);
}


/**
 * Get the bot's permissions in the given channel.
 * @param {GuildChannel} channel The channel
 * @param {boolean} forceFetch Whether to force-fetch the channel
 * @returns {PermissionsBitField}
 */
export async function permissionsIn(channel, forceFetch = false)
{
	const { guild } = channel;
	try {
		await fetchEntity(channel, forceFetch);
	} catch({status}) {
		if(status === 404)
			purgeChannel(channel.id);
		return null;
	}
	try {
		await fetchEntity(guild.roles);
	} catch({status}) {
		if(status === 403 || status === 404)
		{
			purgeGuild(guild.id);
			guild.channels.forEach(({id}) => channels.cache.delete(id));
			client.guilds.cache.delete(guild.id);
		}
		return null;
	}
	return channel.permissionsFor(await guild.members.fetchMe());
}


/**
 * Check if the bot can send a message in that channel.
 * @param {TextChannel|DMChannel} channel
 * @returns 
 */
export async function canSendMessage(channel)
{
	return !channel.guild || (await permissionsIn(channel))?.has(SEND_MESSAGES);
}



if(!Object.hasOwn(ThreadChannel.prototype, "nsfw"))
{
	Object.defineProperty(ThreadChannel.prototype, "nsfw", {
		get: function() { return this.parent?.nsfw; },
	});
}
if(!Object.hasOwn(ThreadChannel.prototype, "fetch"))
{
	const { fetch: baseFetch } = ThreadChannel.prototype;
	Object.defineProperty(ThreadChannel.prototype, "fetch", {
		value: async function(force = true) {
			return Promise.all([
				baseFetch.call(this, force),
				this.guild.channels.fetch(this.parentId, {force}),
			]).then(([res]) => res);
		},
	});
}