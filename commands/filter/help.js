
import { premiumSKU, goldSKU, premiumGuilds, buttons } from "../../steam_news/VIPs.js";

export const storeButtons = buttons(premiumSKU, goldSKU);

/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter)
{
	inter.reply({
		flags: "Ephemeral",
		embeds: [tr.get(inter.locale, "filter.help")],
		components: premiumGuilds.has(inter.guildId) ? [] : [storeButtons],
	});
}