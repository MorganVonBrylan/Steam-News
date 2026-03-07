
/** @typedef {import("discord.js").BaseGuildTextChannel|import("discord.js").AnyThreadChannel} GuildTextChannel */

/**
 * Get's a channel's thread or a thread's siblings
 * @param {GuildTextChannel} channel The channel
 * @returns The threads ids
 */
export async function fetchThreads(channel)
{
	if(channel.isThread())
		channel = channel.parent || await channel.guild.channels.fetch(channel.parentId);

	// Fetching archived threads required the permission to read message history,
	// which SteamNews doesn't have by default
	// and doesn't need outside of this specific situation.
	/** @type {Awaited<ReturnType<import("discord.js").GuildTextThreadManager["fetchActive"]>>} */
	const { threads } = await channel.threads.fetchActive(false);
	return Array.from(threads.keys());
}