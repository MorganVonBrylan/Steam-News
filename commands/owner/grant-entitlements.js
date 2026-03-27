
import {
	premiumSKU, premiumGuilds,
	chameleonSKU, chameleonGuilds,
} from "../../steam_news/VIPs.js";

export const entitlements = {
	Watchers:  { bit: 1<<0, sku: premiumSKU, list: premiumGuilds },
	Chameleon: { bit: 1<<1, sku: chameleonSKU, list: chameleonGuilds },
};

export const description = "Enable entitlements on a server. This only lasts until reboot; see README for permanent changes.";
export const options = [{
	type: INTEGER, name: "subscription", required: true,
	description: "Which subscription to grant?",
	choices: [
		{ name: "Chameleon", value: entitlements.Chameleon.bit },
		{ name: "More watchers", value: entitlements.Watchers.bit },
		{ name: "Gold plan", value: entitlements.Chameleon.bit | entitlements.Watchers.bit },
		{ name: "NOTHING!", value: 0 },
	],
}, {
	type: STRING, name: "server-id",
	description: "The server to which grant/change the free subscription. Defaults to current guild if omitted.",
}];
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export function run(inter)
{
	const subscription = inter.options.getInteger("subscription");
	const guildId = inter.options.getString("server-id") || inter.guildId;
	const known = inter.client.guilds.cache.has(guildId);
	let message = setEntitlements(guildId, subscription);
	if(!known)
		message += "\n*Note: I don't seem to actually be in that server*";
	inter.reply({flags: "Ephemeral", content: message});
}

/**
 * Sets the entitlements for the current bot session.
 * @param {string} guildId The guild id the set entitlements for
 * @param {number|object[]} ents A bitset or array of entitlements
 * @return {string} a confirmation message
 */
export function setEntitlements(guildId, ents)
{
	if(ents instanceof Array)
		ents = ents.reduce((bitset, {bit}) => bitset | bit, 0);

	const messages = [];
	for(const [name, { bit, sku, list }] of Object.entries(entitlements))
	{
		if(ents & bit)
		{
			list.add(guildId);
			messages.push(sku
				? `✅ ${name} entitlement added!`
				: `⚠️ ${name} entitlement added, although it seems disabled`
			);
		}
		else if(list.has(guildId))
		{
			list.delete(guildId);
			messages.push(`❌ ${name} entitlement removed!`);
		}
	}
	return messages.join("\n");
}