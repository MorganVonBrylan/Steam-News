
import { client, auth, sendToMaster } from "../bot.js";

import { stmts } from "./db.js";
const { getLastVote, insertLastVote, updateLastVote, getRecentVoters } = stmts;
const VOTE_NOTIFICATION_COOLDOWN = 604800_000; // 7 days
const VOTE_BONUS_DURATION = 57600_000; // 16 hours

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

const { premium } = auth;
import { ComponentType, ButtonStyle } from "discord.js";
export const premiumSKU = premium?.sku;
export const bonus = premium?.bonus || 0;
export const rebrandSKU = premium?.rebrand;

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

	client.once("clientReady", async () => {
		(await client.application.entitlements.fetch({cache: false}))
			.filter(sku => sku.skuId === premiumSKU && sku.isActive())
			.forEach(({guildId}) => premiumGuilds.add(guildId));
	});

	client.on("entitlementCreate", async ({skuId, userId, guildId}) => {
		switch(skuId)
		{
			case premiumSKU:
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

	client.on("entitlementUpdate", async (_, ent) => {
		if(ent.isActive())
			return;

		if(ent.skuId === premiumSKU)
		{
			premiumGuilds.delete(ent.guildId);
			const guild = await client.guilds.fetch(ent.guildId);
			sendToMaster(`Sub ended. Guild: ${guild} (${ent.guildId}), user: ${ent.userId}`);
		}
		else
		{
			const {userId: id} = ent;
			sendToMaster(`Supporter lost: <@${id}> (${ent.userId})`);
		}
	});

	client.on("entitlementDelete", async ent => {
		if(ent.skuId === premiumSKU)
		{
			premiumGuilds.delete(ent.guildId);
			const guild = await client.guilds.fetch(ent.guildId);
			sendToMaster(`Sub cancelled. Guild: ${guild} (${ent.guildId}), user: ${ent.userId}`);
		}
		else
		{
			const {userId: id} = ent;
			sendToMaster(`Supporter cancelled: <@${id}> (${ent.userId})`);
		}
	});
}
