
import { client, auth, sendToMaster } from "../bot.js";

import db, { stmts } from "./db.js";
const { getLastVote, insertLastVote, updateLastVote } = stmts;
const VOTE_NOTIFICATION_COOLDOWN = 604800_000; // 7 days
const VOTE_BONUS_DURATION = 43200_000; // 12 hours, which is how often one can vote

class Voters extends Map {
	/**
	 * Add a voter to the list
	 * @param {string} id The user's id
	 * @param {Parameters<setTimeout>[1]} timeout How long before the vote expires, in ms
	 */
	set(id, timeout = VOTE_BONUS_DURATION) {
		clearTimeout(this.get(id));
		super.set(id, setTimeout(this.delete.bind(this, id), timeout));
	}
}
const topGGVoters = new Voters();
const dblVoters = new Voters();


db.run("DELETE FROM Voters WHERE lastVote < ?", Date.now() - VOTE_BONUS_DURATION);
for(const { id, lastVote } of db.prepare("SELECT * FROM Voters").all())
	topGGVoters.set(id, Date.now() - lastVote);


export const voted = topGGVoters.has.bind(topGGVoters);
export const votedDBL = dblVoters.has.bind(dblVoters);

export function addVoter(id, lang, forceNotif = false)
{
	topGGVoters.set(id);
	const date = Date.now();
	const lastVote = getLastVote(id);
	let res;
	if(forceNotif || !lastVote || date - lastVote > VOTE_NOTIFICATION_COOLDOWN)
		res = client.users.fetch(id)
			.then(user => user.send(tr.get(lang || "en", "voting.thanks")))
			.catch(Function.noop);

	if(lastVote)
		updateLastVote({id, date});
	else
		insertLastVote({id, date});

	return res;
}

export function addDBLVoter(id, lang)
{
	topGGVoters.set(id);
	return client.users.fetch(id)
		.then(user => user.send(tr.get(lang || "en", "voting.thanks-dbl")))
		.catch(Function.noop);
}

export const premiumGuilds = new Set();
export const chameleonGuilds = new Set();
export let STORE_LINK = "See the store in the bot's profile";
client.once("shardReady", () => STORE_LINK = `https://discord.com/application-directory/${client.user.id}/store`);

const { premium } = auth;
import { ComponentType, ButtonStyle } from "discord.js";
export const premiumSKU = premium?.moreWatchers;
export const bonus = premium?.bonus || 0;
export const rebrandSKU = premium?.rebrand;
export const chameleonSKU = premium?.chameleon;
export const goldSKU = premium?.gold;
export const premiumEnabled = premiumSKU || chameleonSKU || goldSKU;

if(premium.freeGoldPlans)
{
	let { freeGoldPlans } = premium;
	if(!Array.isArray(freeGoldPlans))
		freeGoldPlans = Object.values(freeGoldPlans);

	for(const guildId of freeGoldPlans)
	{
		premiumGuilds.add(guildId);
		chameleonGuilds.add(guildId);
	}
	console.log("Enabled", freeGoldPlans.length, "free gold plans.");
}
if(premium.freeWatchers)
{
	let { freeWatchers } = premium;
	if(!Array.isArray(freeWatchers))
		freeWatchers = Object.values(freeWatchers);

	for(const guildId of freeWatchers)
		premiumGuilds.add(guildId);
	console.log("Enabled", freeWatchers.length, "free watchers plans.");
}

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

if(premiumEnabled)
{
	const { guilds } = client;

	/* Doing subscriber role properly requires GUILD_MEMBERS, and I'm not even sure I can get the user id properly
	let supportServer, subRole;
	client.once("clientReady", async () => {
		supportServer = await guilds.fetch(premium.supportServer);
		subRole = supportServer.roles.fetch(premium.premiumRole);
	});
	client.on("guildMemberAdd", member => {});
	*/

	function wait_a_bit() {
		return new Promise(resolve => setTimeout(resolve, 3000));
	}
	function subName(skuId) {
		return skuId === goldSKU ? "Gold"
			: skuId === premiumSKU ? "More watchers"
			: skuId === chameleonSKU ? "Chameleon"
			: `Unknown (${skuId})`;
	}

	client.once("clientReady", async () => {
		const start = Date.now();
		const entitlements = await client.application.entitlements.fetch({cache: false});
		for(const entitlement of entitlements.values())
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
		import("./watchers.js").then(({scheduleChecks}) => scheduleChecks());
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
				premiumGuilds.add(guildId);
			case chameleonSKU:
				if(skuId !== premiumSKU)
					chameleonGuilds.add(guildId);
				const { ownerId } = await guilds.fetch(guildId);
				sendToMaster(`New ${subName(skuId)} sub! Guild: ${guildId}, owner: ${ownerId}, user: ${userId}`);
				break;
			case rebrandSKU:
				sendToMaster(`<@${userId}> bought a rebrand! (${userId})`);
				break;
			default:
				sendToMaster(`New supporter with an unknown (${skuId}) subscription! <@${userId}> (${userId})`);
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
		const guild = await guilds.fetch(guildId);
		sendToMaster(`${subName(skuId)} sub ended. Guild: ${guildId}, user: ${userId}`);
	});

	client.on("entitlementDelete", async ({skuId, guildId, userId}) => {
		removeEntitlement(skuId, guildId);
		const guild = await guilds.fetch(guildId);
		sendToMaster(`${subName(skuId)} sub cancelled. Guild: ${guildId}, user: ${userId}`);
	});
}
