
import { watchSteam } from "../../steam_news/watchers.js";

import { updateCmd as updateUnwatch } from "../~guild/unwatch.js";

import { checkPerms, STEAM_COLOR } from "./~commons.js";

export const defaultMemberPermissions = "0";
export { options } from "./~commons.js";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const channel = inter.options.getChannel("channel") || inter.channel;
	const cannotSend = await checkPerms(channel);
	if(cannotSend)
		return inter.reply({flags: "Ephemeral", content: tr.get(inter.locale, `watch.${cannotSend}`, channel.toString())});

	const role = inter.options.getRole("role");
	watchSteam({
		guildId: inter.guildId,
		channelId: channel.id,
		roleId: role?.id || null,
	});
	inter.reply({ embeds: [{
		color: STEAM_COLOR,
		description: role
			? tr.get(inter.locale, "steam.watched-role", { channel, role })
			: tr.get(inter.locale, "steam.watched", channel.toString())},
	]});
	updateUnwatch(inter.guild);
}
