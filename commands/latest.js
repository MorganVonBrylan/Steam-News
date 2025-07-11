
import { query, getDetails, isNSFW, HTTPError } from "../steam_news/api.js";
import interpretAppidOption from "../utils/interpretAppidOption.function.js";
import { isKnown, saveAppInfo, isNSFW as isAppNSFW } from "../steam_news/watchers.js";
import toEmbed from "../steam_news/toEmbed.function.js";

import { options as localeOptions, steamLanguages } from "./locale.js";
const languageOption = localeOptions.find(({name}) => name === "language");

import { PermissionFlagsBits } from "discord.js";
const { SendMessages: SEND_MESSAGES } = PermissionFlagsBits;

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
export async function run(inter)
{
	const { appid, defer } = await interpretAppidOption(inter);
	if(!appid)
		return;

	const lang = inter.options.getString("language") || inter.locale;
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

	const channel = inter.channel || await inter.guild.channels.fetch(inter.channelId);

	if(!appnews.newsitems.length)
		inter.editReply({flags: "Ephemeral", content: t("no-news")});
	else if(isAppNSFW(appid) && !channel.nsfw)
		inter.editReply({flags: "Ephemeral", content: t("NSFW-content-news")});
	else
	{
		const news = toEmbed(appnews.newsitems[0], inter.locale);
		const reply = inter.editReply({ embeds: [news] });
		if(news?.yt && await canSendMessage(inter))
			reply.then(() => channel.send(news.yt));
	}

}

async function canSendMessage({guild, channel})
{
	return !guild
		|| channel.memberPermissions(await guild.members.fetchMe())?.has(SEND_MESSAGES);
}