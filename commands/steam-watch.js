
import { guildCommands } from "@brylan/djs-commands";
import { permissionsIn } from "../utils/discord.js";
import { watchSteam } from "../steam_news/watchers.js";
const createCmd = guildCommands.createCmd.bind(null, "steam-unwatch");

export const defaultMemberPermissions = "0";
export const options = [{
	type: ROLE, name: "role",
	description: "A role to ping when news are posted",
}, {
	type: CHANNEL, name: "channel",
	channelTypes: ALL_TEXT_CHANNEL_TYPES,
	description: "The channel where to send the news (defaults to current channel if not provided)"
}];
export async function run(inter)
{
	const channel = inter.options.getChannel("channel")
		|| await inter.guild.channels.fetch(inter.channelId);
	const perms = await permissionsIn(channel);
	const t = tr.set(inter.locale, "watch");

	if(!perms?.has(SEND_MESSAGES))
		return inter.reply({ephemeral: true, content: t("cannot-send", channel)});
	else if(!perms.has(EMBED_LINKS))
		return inter.reply({ephemeral: true, content: t("cannot-embed", channel)});

	watchSteam(channel.id, inter.options.getRole("role")?.id);
	inter.reply(tr.get(inter.locale, "steam.watched", channel));
	createCmd(inter.guild, true);
}
