
import { rebrandSKU, chameleonGuilds, premiumGuilds, STORE_LINK } from "../../steam_news/VIPs.js";
import { PermissionsBitField } from "discord.js";
const { Flags: { Administrator: ADMIN } } = PermissionsBitField;

export const description = "Check what premium entitlement you and this server have";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "premium");
	const { guildId } = inter;
	const rebrand = inter.entitlements.find(({skuId}) => skuId === rebrandSKU);
	const moreWatchers = premiumGuilds.has(guildId);
	const chameleon = chameleonGuilds.has(guildId);
	const everything = rebrand && moreWatchers && chameleon;
	const embeds = [{
		title: t("server-subscription"),
		description: t(moreWatchers && chameleon ? "sub-gold"
			: moreWatchers ? "sub-watchers"
			: chameleon ? "sub-chameleon"
			: "no-subscription"
		)
	}];
	if(rebrand)
		embeds.push({
			title: t("user-entitlements"),
			description: t(inter.memberPermissions.has(ADMIN) ? "has-rebrand" : "has-rebrand-not-admin")
		});

	inter.reply(everything ? {embeds} : { content: STORE_LINK, embeds });
}