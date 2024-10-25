
import { query, getDetails, isNSFW, HTTPError } from "../steam_news/api.js";
import interpretAppidOption from "../utils/interpretAppidOption.function.js";
import { isKnown, saveAppInfo, isNSFW as isAppNSFW } from "../steam_news/watchers.js";
import toEmbed from "../steam_news/toEmbed.function.js";

import { canSendMessage, fetchEntity } from "../utils/discord.js";

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
	catch(err) {
		await defer;
		inter.editReply(err instanceof HTTPError
			? (err.code === 403 ? t("api-403") : t("api-err", err.code))
			: "Error while fetching data from the Steam API. Please retry later.");
		return;
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

	const { channel } = inter;
	await fetchEntity(channel);
	let news;
	const reply = inter.editReply(isAppNSFW(appid) && !channel.nsfw
		? { ephemeral: true, content: t("NSFW-content-news") }
		: { embeds: [news = await toEmbed(appnews.newsitems[0], inter.locale)] }
	);

	if(news?.yt && await canSendMessage(channel))
		reply.then(() => channel.send(news.yt));
}
