
import { checkSKU, storeButtons } from "./~checkSKU.js";

export const description = "Get explanation on how to use the chameleon features.";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
    const t = tr.set(inter.locale, "premium.chameleon");
	const chameleonAccess = checkSKU(inter, false);
	if(chameleonAccess === null)
		return inter.reply({flags: "Ephemeral", content: t("disabled")});

	inter.reply({
		flags: "Ephemeral",
		embeds: [t("help")],
		components: [storeButtons],
	});
}