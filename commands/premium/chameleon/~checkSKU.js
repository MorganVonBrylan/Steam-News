
import { chameleonSKU, goldSKU, chameleonGuilds, buttons } from "../../../steam_news/VIPs.js";

export const storeButtons = buttons(chameleonSKU, goldSKU);

export default checkSKU;
/**
 * Checks if chameleon features are enabled and whether the guild the command was sent in has access to them.
 * If it doesn't, replies with the appropriate message if 'reply' is set to true.
 * @param {import("discord.js").ChatInputCommandInteraction} inter The command interaction
 * @param {boolean} [reply] Whether or not to reply. Defaults to true.
 * @returns {?boolean} null if the features are disabled, true if the guild can use the features, false otherwise
 */
export function checkSKU(inter, reply = true)
{
	if(!chameleonSKU && !goldSKU)
	{
		if(reply)
			inter.reply({flags: "Ephemeral", content: tr.get(inter.locale, "premium.disabled")});
		return null;
	}
	else if(!chameleonGuilds.has(inter.guildId))
	{
		if(reply) inter.reply({flags: "Ephemeral",
			content: tr.get(inter.locale, "premium.chameleon.pay"),
			components: [storeButtons],
		});
		return false;
	}
	else
		return true;
}