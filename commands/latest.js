
import { query, getDetails, isNSFW } from "../steam_news/api.js";
import interpretAppidOption from "../interpretAppidOption.function.js";
import { isKnown, saveAppInfo, isNSFW as isAppNSFW } from "../steam_news/watchers.js";
import toEmbed from "../steam_news/toEmbed.function.js";

import { PermissionFlagsBits } from "discord.js";
const { SendMessages: SEND_MESSAGES } = PermissionFlagsBits;

export const dmPermission = true;
export const options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
export { default as autocomplete } from "../autocomplete/search.js";
export async function run(inter)
{
	const { appid, defer } = await interpretAppidOption(inter);
	if(!appid)
		return;

	const t = tr.set(inter.locale);
	const fetchInfo = isKnown(appid) ? null : getDetails(appid);
	let info;
	try	{
		info = await query(appid, 1);
	}
	catch(e) {
		await defer;
		return inter.editReply(e.message.includes("403")
			? "This app does not exist or is private."
			: "Error while fetching data from the Steam API. Please retry later.");
	}
	const { appnews } = info;
	await defer;
	if(!appnews)
		return inter.editReply({content: t("bad-appid")});

	if(fetchInfo)
	{
		const details = await fetchInfo;
		if(details.type === "dlc")
			return inter.editReply({ephemeral: true, content: t("no-DLC-news")});

		saveAppInfo(appid, { name: details.name, nsfw: +isNSFW(details) });
	}

	if(!appnews.newsitems.length)
		return inter.editReply({ephemeral: true, content: t("no-news")});

	let news;
	const reply = inter.editReply(isAppNSFW(appid) && !inter.channel.nsfw
		? { ephemeral: true, content: t("NSFW-content-news") }
		: { embeds: [news = await toEmbed(appnews.newsitems[0], inter.locale)] }
	);

	if(news?.yt && await canSendMessage(inter))
		reply.then(() => inter.channel.send(news.yt));
}

async function canSendMessage({guild, channel})
{
	return !guild
		|| channel?.permissionsFor(await guild.members.fetchMe())?.has(SEND_MESSAGES);
}