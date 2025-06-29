
import { querySteam, STEAM_ICON } from "../steam_news/api.js";
import toEmbed from "../steam_news/toEmbed.function.js";

import { PermissionFlagsBits } from "discord.js";
const { SendMessages: SEND_MESSAGES } = PermissionFlagsBits;

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export async function run(inter) {
	const defer = inter.deferReply().catch(error);
	const appnews = await querySteam();
	await defer;

	const news = await toEmbed(appnews.newsitems[0], inter.locale);
	news.footer.iconUrl = STEAM_ICON;
	const reply = inter.editReply({ embeds: [news] });

	if(news.yt && await canSendMessage(inter))
		reply.then(() => inter.channel.send(news.yt));
}

async function canSendMessage({guild, channel})
{
	return !guild
		|| channel?.permissionsFor(await guild.members.fetchMe())?.has(SEND_MESSAGES);
}