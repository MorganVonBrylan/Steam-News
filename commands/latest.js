
import {
	query, querySteam, queryGroup,
	getDetails, isNSFW, groupDetails,
	HTTPError,
} from "../steam_news/api.js";
import { interpretAppidOption, mention as cmdMention, determineLanguage } from "../utils/commands.js";
import { isKnown, saveAppInfo, isNSFW as isAppNSFW } from "../steam_news/watchers.js";
import toEmbed from "../steam_news/toEmbed.function.js";
import { getNameOrId } from "./group.js";

import { options as localeOptions, steamLanguages } from "./locale.js";
const languageOption = localeOptions.find(({name}) => name === "language");

import { PermissionFlagsBits as PERMISSIONS } from "discord.js";
const REQUIRED_PERMS = PERMISSIONS.ViewChannel | PERMISSIONS.SendMessages;

import { chameleonGuilds } from "../steam_news/VIPs.js";
import { Webhook } from "./premium/chameleon/~webhook.js";
import { getWebhook } from "../steam_news/db_api.js";

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
import autocompleteGame from "../autocomplete/search.js";

export { commandGroupAutocomplete as autocomplete } from "@brylan/djs-commands";

export const options = [{
	type: SUBCOMMAND, name: "game-news",
	autocomplete: autocompleteGame,
	options: [{
		type: STRING, name: "game", required: true,
		description: "The game’s name or id",
		autocomplete: true,
	}, {
		...languageOption,
		description: "The news' language. Availability depends on the game's developers."
	}],
}, {
	type: SUBCOMMAND, name: "steam-news",
	options: [{
		...languageOption,
		description: "The news' language.",
	}],
}, {
	type: SUBCOMMAND, name: "group-post",
	options: [{
		type: STRING, name: "group", required: true,
		description: "The group's name or URL",
	}, {
		...languageOption,
		description: "The post's language. Availability depends on the group members.",
	}],
}];
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const lang = determineLanguage(inter, "language");
	const t = tr.set(lang);

	const channel = inter.channel
		|| await inter.client.channels.fetch(inter.channelId).catch(err => 
			// We assume nsfw:true because inaccessible channels are most likely either DMs or some other form of private channel
			err.status === 403 ? { nsfw: true }
			: err.status === 404 ? null
			: error(err)
		);

	if(!channel)
		return inter.editReply({flags: "Ephemeral", content: t("error")});

	let type = inter.options.getSubcommand();
	let appnews;

	switch(type) {
	case "game-news": {
		type = "news";
		const { appid, defer } = await interpretAppidOption(inter);
		if(!appid)
			return;
		
		const fetchInfo = isKnown(appid) ? null : getDetails(appid);
		await defer;
		try	{
			appnews = await query(appid, steamLanguages[lang]);
		}
		catch(err) {
			inter.editReply(err instanceof HTTPError
				? (err.code === 403 ? t("api-403") : t("api-err", err.code))
				: "Error while fetching data from the Steam API. Please retry later.");
			return;
		}

		if(!appnews)
			return inter.editReply({content: t("bad-appid")});

		if(fetchInfo)
		{
			const details = await fetchInfo;
			if(details.type === "dlc")
				return inter.editReply({flags: "Ephemeral", content: t("no-DLC-news")});

			saveAppInfo(appid, { name: details.name, nsfw: +isNSFW(details) });
		}

		if(isAppNSFW(appid) && !(channel.nsfw || channel.isDMBased()))
			return inter.editReply({flags: "Ephemeral", content: t("NSFW-content-news")});
		break;
	}
	case "steam-news": {
		type = "steam";
		await inter.deferReply();
		appnews = await querySteam(steamLanguages[lang]);
		break;
	}
	case "group-post": {
		type = "group";
		await inter.deferReply();
		const nameOrId = getNameOrId(inter.options.getString("group"));
		const id = typeof nameOrId === "number" ? nameOrId
			: (await groupDetails(nameOrId))?.id;

		if(!id)
			return inter.editReply(t("bad-group"));

		appnews = await queryGroup(id, steamLanguages[lang]);
		if(appnews.error)
		{
			console.error(appnews);
			return inter.editReply("Error while fetching data from the Steam API. Please retry later.");
		}
		break;
	}
	}

	if(!appnews.newsitems.length)
		inter.editReply(t(type === "group" ? "no-posts" : "no-news"));
	else
	{
		const { newsitems: [newsitem] } = appnews;
		const news = await toEmbed(newsitem, lang);
		const { guildId } = inter;
		if(guildId && chameleonGuilds.has(guildId))
		{
			const { appid, groupId } = appnews;
			const webhookInfo = getWebhook(type, { guildId, appid, groupId });
			if(webhookInfo)
			{
				if(channel.isThread() && !webhookInfo.includes("#t"))
					webhookInfo += "#t";
				const webhook = new Webhook(webhookInfo, channel.id);
				const command = cmdMention(inter);
				const guildLocale = determineLanguage(inter) || lang;
				try {
					await webhook.send({embeds: [
						{ description: tr.get(guildLocale, "used-command", { user: inter.user, command }) },
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