
import { client, auth, sendToMaster } from "../bot.js";

import { stmts } from "./db.js";
const { getLastVote, insertLastVote, updateLastVote, getRecentVoters } = stmts;
const VOTE_NOTIFICATION_COOLDOWN = 604800_000; // 7 days
const VOTE_BONUS_DURATION = 43200_000; // 12 hours, which is how often one can vote

const voters = new Map();
function setVoter(id, timeout)
{
	clearTimeout(voters.get(id));
	voters.set(id, setTimeout(voters.delete.bind(voters, id), timeout));
}

for(const {id, lastVote} of getRecentVoters(Date.now() - VOTE_BONUS_DURATION))
	setVoter(id, Date.now() - lastVote);


export const voted = voters.has.bind(voters);

export function getVoters() { return [...voters.keys()]; }

export function addVoter(id, lang, forceNotif = false)
{
	setVoter(id, VOTE_BONUS_DURATION);

	const date = Date.now();
	const lastVote = getLastVote(id);
	if(forceNotif || !lastVote || date - lastVote > VOTE_NOTIFICATION_COOLDOWN)
	{
		client.users.fetch(id)
			.then(user => user.send(tr.get(lang || "en", "voting.thanks")))
			.catch(Function.noop);
	}

	if(lastVote)
		updateLastVote({id, date});
	else
		insertLastVote({id, date});
}

export const premiumGuilds = new Set();
export const chameleonGuilds = new Set();

const { premium } = auth;
import { ComponentType, ButtonStyle } from "discord.js";
export const premiumSKU = premium?.sku;
export const bonus = premium?.bonus || 0;
export const rebrandSKU = premium?.rebrand;
export const chameleonSKU = premium?.chameleon;
export const goldSKU = premium?.gold;

export function button(sku_id) {
	return { type: ComponentType.Button, style: ButtonStyle.Premium, sku_id };
}
export function buttons(...skus) {
	skus = skus.filter(Boolean);
	return skus.length ? {
		type: ComponentType.ActionRow,
		components: skus.map(button),
	} : null;
}

if(premiumSKU)
{
	/* Doing subscriber role properly requires GUILD_MEMBERS, and I'm not even sure I can get the user id properly
	let supportServer, subRole;
	client.once("clientReady", async () => {
		supportServer = await client.guilds.fetch(premium.supportServer);
		subRole = supportServer.roles.fetch(premium.premiumRole);
	});
	client.on("guildMemberAdd", member => {});
	*/

	function wait_a_bit() {
		return new Promise(resolve => setTimeout(resolve, 3000));
	}

	client.once("clientReady", async () => {
		const start = Date.now();
		for(const entitlement of await client.application.entitlements.fetch({cache: false}))
		{
			if(!entitlement.isActive())
				continue;

			const { skuId, guildId } = entitlement;
			if(skuId === premiumSKU || skuId === goldSKU)
				premiumGuilds.add(guildId);
			if(skuId === chameleonSKU || skuId === goldSKU)
				chameleonGuilds.add(guildId);
		}
		console.log(`Entitlements loaded in ${((Date.now()-start) / 1000).toFixed(1)}s`);
	});

	client.on("entitlementCreate", async ({skuId, userId, guildId}) => {
		// Changing a subscription call both an ENTITLEMENT_UPDATE and ENTITLEMENT_CREATE events
		// Not sure if the order is guaranteed, so in doubt,
		// wait a bit before granting the new entitlement to make sure the UPDATE doesn't remove it
		await wait_a_bit();
		switch(skuId)
		{
			case goldSKU:
			case premiumSKU:
			case chameleonSKU:
				if(skuId !== premiumSKU)
					chameleonGuilds.add(guildId);
				if(skuId !== chameleonSKU)
					premiumGuilds.add(guildId);
				const guild = await client.guilds.fetch(guildId);
				sendToMaster(`New sub! Guild: ${guild} (${guildId}), owner: ${guild.ownerId}, user: ${userId}`);
				break;
			case rebrandSKU:
				sendToMaster(`<@${userId}> bought a rebrand! (${userId})`);
				break;
			default:
				sendToMaster(`New supporter! <@${userId}> (${userId})`);
		}
	});


	function removeEntitlement(skuId, guildId) {
		if(skuId === premiumSKU || skuId === goldSKU)
			premiumGuilds.delete(guildId);
		if(skuId === chameleonSKU || skuId === goldSKU)
			chameleonGuilds.delete(guildId);
	}

	client.on("entitlementUpdate", async (_, entitlement) => {
		if(entitlement.isActive())
			return;

		const { skuId, guildId, userId } = entitlement;
		removeEntitlement(skuId, guildId);
		const guild = await client.guilds.fetch(guildId);
		sendToMaster(`Sub ended. Guild: ${guild} (${guildId}), user: ${userId}`);
	});

	client.on("entitlementDelete", async ({skuId, guildId, userId}) => {
		removeEntitlement(skuId, guildId);
		const guild = await client.guilds.fetch(guildId);
		sendToMaster(`Sub cancelled. Guild: ${guild} (${guildId}), user: ${userId}`);
	});
}
