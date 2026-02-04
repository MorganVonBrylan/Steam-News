
import {
	premiumSKU, premiumGuilds,
} from "../../steam_news/VIPs.js";

export const entitlements = {
	Watchers:  { bit: 1<<0, sku: premiumSKU, list: premiumGuilds },
};

export const description = "Enable entitlements on the test server.";
export const options = [{
	type: INTEGER, name: "subscription", required: true,
	description: "Which subscription to emulate?",
	choices: [
		{ name: "More watchers", value: entitlements.Watchers.bit },
		{ name: "NOTHING!", value: 0 },
	],
}];
export function run(inter)
{
	const subscription = inter.options.getInteger("subscription");
	inter.reply({flags: "Ephemeral", content: setEntitlements(inter.guildId, subscription)});
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