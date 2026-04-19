
import { querySteam } from "../steam_news/api.js";
import toEmbed from "../steam_news/toEmbed.function.js";
import { getWebhook, getLocale } from "../steam_news/db_api.js";
import { Webhook } from "./premium/chameleon/~webhook.js";
import { mention as cmdMention } from "../utils/commands.js";
import { chameleonGuilds } from "../steam_news/VIPs.js";

import { PermissionFlagsBits } from "discord.js";
const { SendMessages: SEND_MESSAGES } = PermissionFlagsBits;

import { options as localeOptions, steamLanguages } from "./locale.js";
const languageOption = localeOptions.find(({name}) => name === "language");

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export const options = [languageOption];
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter) {
	await inter.deferReply().catch(error);
	
	const { locale, guildId } = inter;
	const lang = inter.options.getString("language") || locale;
	const appnews = await querySteam(steamLanguages[lang]);
	const news = await toEmbed(appnews.newsitems[0], locale);

	let webhookInfo;
	if(guildId && chameleonGuilds.has(guildId) && (webhookInfo = getWebhook("steam", guildId)))
	{
		const { channel, user } = inter;
		if(channel.isThread() && !webhookInfo.includes("#t"))
			webhookInfo += "#t";
		const webhook = new Webhook(webhookInfo, channel.id);
		const command = cmdMention(inter);
		const locale = getLocale(guildId)?.lang || lang;
		try {
			await webhook.send({embeds: [
				{ description: tr.get(locale, "used-command", { user, command }) },
				news,
			]});
			if(news.yt)
				webhook.send(news.yt);
			inter.deleteReply();
			return;
		} catch(err) {
			if(!err.webhookPurged)
				console.warn(err);
		}
	}

	const reply = inter.editReply({ embeds: [news] });

	if(news.yt && await canSendMessage(inter))
		reply.then(() => inter.channel.send(news.yt));
}

async function canSendMessage({guild, channel})
{
	return !guild
		|| channel?.permissionsFor(await guild.members.fetchMe())?.has(SEND_MESSAGES);
}