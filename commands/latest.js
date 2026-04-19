
import { query, getDetails, isNSFW, HTTPError } from "../steam_news/api.js";
import { interpretAppidOption, mention as cmdMention } from "../utils/commands.js";
import { isKnown, saveAppInfo, isNSFW as isAppNSFW } from "../steam_news/watchers.js";
import toEmbed from "../steam_news/toEmbed.function.js";

import { options as localeOptions, steamLanguages } from "./locale.js";
const languageOption = localeOptions.find(({name}) => name === "language");

import { PermissionFlagsBits as PERMISSIONS } from "discord.js";
const REQUIRED_PERMS = PERMISSIONS.ViewChannel | PERMISSIONS.SendMessages;

import { chameleonGuilds } from "../steam_news/VIPs.js";
import { Webhook } from "./premium/chameleon/~webhook.js";
import { getWebhook, getLocale } from "../steam_news/db_api.js";

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export const options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}, 
	languageOption,
];
export { default as autocomplete } from "../autocomplete/search.js";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const { appid, defer } = await interpretAppidOption(inter);
	if(!appid)
		return;

	const { guildId, locale } = inter;
	const lang = inter.options.getString("language") || locale;
	const t = tr.set(lang);
	const fetchInfo = isKnown(appid) ? null : getDetails(appid);
	await defer;
	let info;
	try	{
		info = await query(appid, steamLanguages[lang]);
	}
	catch(err) {
		inter.editReply(err instanceof HTTPError
			? (err.code === 403 ? t("api-403") : t("api-err", err.code))
			: "Error while fetching data from the Steam API. Please retry later.");
		return;
	}

	const appnews = info;
	if(!appnews)
		return inter.editReply({content: t("bad-appid")});

	if(fetchInfo)
	{
		const details = await fetchInfo;
		if(details.type === "dlc")
			return inter.editReply({flags: "Ephemeral", content: t("no-DLC-news")});

		saveAppInfo(appid, { name: details.name, nsfw: +isNSFW(details) });
	}

	const channel = inter.channel
		|| await inter.client.channels.fetch(inter.channelId).catch(err => 
			// We assume nsfw:true because inaccessible channels are most likely either DMs or some other form of private channel
			err.status === 403 ? { nsfw: true }
			: err.status === 404 ? null
			: error(err)
		);

	if(!channel)
		return inter.editReply({flags: "Ephemeral", content: t("error")});;

	if(!appnews.newsitems.length)
		inter.editReply({flags: "Ephemeral", content: t("no-news")});
	else if(isAppNSFW(appid) && !(channel.nsfw || channel.isDMBased()))
		inter.editReply({flags: "Ephemeral", content: t("NSFW-content-news")});
	else
	{
		const news = await toEmbed(appnews.newsitems[0], locale);

		if(guildId && chameleonGuilds.has(guildId))
		{
			let webhookInfo = getWebhook("news", { guildId, appid });
			if(webhookInfo)
			{
				if(channel.isThread() && !webhookInfo.includes("#t"))
					webhookInfo += "#t";
				const webhook = new Webhook(webhookInfo, channel.id);
				const command = cmdMention(inter);
				const locale = getLocale(guildId)?.lang || lang;
				try {
					await webhook.send({embeds: [
						{ description: tr.get(locale, "used-command", { user: inter.user, command }) },
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
		}

		const reply = inter.editReply({ embeds: [news] });
		try {
		if(news.yt && await canSendMessage(channel))
			reply.then(() => channel.send(news.yt));
		}
		catch(err) {
			error(err);
			console.error("Channel:", channel);
		}
	}

}

async function canSendMessage(channel)
{
	return "send" in channel &&
		(!channel.guild
		|| !channel.locked
		&& channel.permissionsFor(await channel.guild.members.fetchMe())?.has(REQUIRED_PERMS));
}