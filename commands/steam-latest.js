
import { querySteam, STEAM_ICON } from "../steam_news/api.js";
import toEmbed from "../steam_news/toEmbed.function.js";

import { PermissionFlagsBits } from "discord.js";
const { SendMessages: SEND_MESSAGES } = PermissionFlagsBits;

import { options as localeOptions, steamLanguages } from "./locale.js";
const languageOption = localeOptions.find(({name}) => name === "language");

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export const options = [languageOption];
export async function run(inter) {
	await inter.deferReply().catch(error);
	
	const lang = inter.options.getString("language") || inter.locale;
	const appnews = await querySteam(steamLanguages[lang]);

	const news = toEmbed(appnews.newsitems[0], inter.locale);
	news.footer.iconUrl = STEAM_ICON;
	const reply = inter.editReply({ embeds: [news] });

	if(news.yt && await canSendMessage(inter))
		reply.then(() => inter.channel.send(news.yt));
}

async function canSendMessage({guild, channel})
{
	return !guild
		|| channel?.memberPermissions(await guild.members.fetchMe())?.has(SEND_MESSAGES);
}