
import { chameleonSKU, goldSKU, chameleonGuilds, buttons } from "../../../steam_news/VIPs.js";

export const storeButtons = buttons(chameleonSKU, goldSKU);

export default checkSKU;
/**
 * Checks if chameleon features are enabled and whether the guild the command was sent in has access to them.
 * If it doesn't, replies with the appropriate message if the translation function is provided.
 * @param {ChatInputCommandInteraction} inter The command interaction
 * @param {function} t The translation function. Leave it undefined to disable the replies.
 * @returns {?boolean} null if the features are disabled, true if the guild can use the features, false otherwise
 */
export function checkSKU(inter, t)
{
	if(!chameleonSKU && !goldSKU)
	{
		if(t) inter.reply({flags: "Ephemeral", content: t("disabled")});
		return null;
	}
	else if(!chameleonGuilds.has(inter.guildId))
	{
		if(t) inter.reply({flags: "Ephemeral",
			content: t("pay"),
			components: [storeButtons],
		});
		return false;
	}
	else
		return true;
}