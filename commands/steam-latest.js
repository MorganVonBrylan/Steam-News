
import { querySteam, STEAM_ICON } from "../steam_news/api.js";
import toEmbed from "../steam_news/toEmbed.function.js";
import { canSendMessage } from "../utils/discord.js";

export const dmPermission = true;
export async function run(inter) {
	const defer = inter.deferReply().catch(error);
	const {appnews} = await querySteam(1);
	await defer;

	const news = await toEmbed(appnews.newsitems[0], inter.locale);
	news.footer.iconUrl = STEAM_ICON;
	const reply = inter.editReply({ embeds: [news] });

	if(news.yt && await canSendMessage(inter.channel))
		reply.then(() => inter.channel.send(news.yt));
}
