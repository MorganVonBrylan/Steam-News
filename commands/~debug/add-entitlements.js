
import {
	premiumSKU, premiumGuilds,
} from "../../steam_news/VIPs.js";

const entitlements = {
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
	const { guildId } = inter;
	const messages = [];
	for(const [name, { bit, sku, list }] of Object.entries(entitlements))
	{
		if(subscription & bit)
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
	
	inter.reply({flags: "Ephemeral", content: messages.join("\n")});
}
