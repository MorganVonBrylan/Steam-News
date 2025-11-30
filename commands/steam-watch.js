
import { stmts } from "../steam_news/db.js";
const { watchSteam } = stmts;

import { guildCommands } from "@brylan/djs-commands";
const createCmd = guildCommands.createCmd.bind(null, "steam-unwatch");

import { checkPerms } from "./watch.js";

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
	const channel = inter.options.getChannel("channel") || inter.channel;
	const cannotSend = await checkPerms(channel);
	if(cannotSend)
		return inter.reply({flags: "Ephemeral", content: tr.get(inter.locale, `watch.${cannotSend}`, channel.toString())});

	watchSteam({
		guildId: inter.guildId,
		channelId: channel.id,
		roleId: inter.options.getRole("role")?.id,
	});
	inter.reply(tr.get(inter.locale, "steam.watched", channel.toString()));
	createCmd(inter.guild, true);
}
