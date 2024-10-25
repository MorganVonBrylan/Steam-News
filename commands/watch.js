
import { STEAM_APPID } from "../steam_news/api.js";
import interpretAppidOption from "../utils/interpretAppidOption.function.js";

import importJSON from "../utils/importJSON.function.js";
const { WATCH_LIMIT, WATCH_VOTE_BONUS } = importJSON("steam_news/limits.json");
const LIMIT_WITH_VOTE = WATCH_LIMIT + WATCH_VOTE_BONUS;
import { voted, premiumSKU, bonus as PREMIUM_BONUS } from "../steam_news/VIPs.js";
const MAX_LIMIT = LIMIT_WITH_VOTE + PREMIUM_BONUS;
import { voteURL } from "../topGG.js";

import { watch, unwatch, getAppInfo, purgeApp } from "../steam_news/watchers.js";
import { HTTPError } from "../steam_news/api.js";

import { PermissionFlagsBits } from "discord.js";
const { SendMessages: SEND_MESSAGES, EmbedLinks: EMBED_LINKS } = PermissionFlagsBits;

import { guildCommands } from "@brylan/djs-commands";
const updateUnwatch = guildCommands.updateCmd.bind(null, "unwatch");


export const defaultMemberPermissions = "0";
export const options = [{
	type: STRING, name: "type", required: true,
	description: "Whether to watch news or price changes",
	choices: [{name: "News", value: "news"}, {name: "Price", value: "price"}],
}, {
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}, {
	type: ROLE, name: "role",
	description: "A role to ping when news are posted",
}, {
	type: CHANNEL, name: "channel",
	channelTypes: ALL_TEXT_CHANNEL_TYPES,
	description: "The channel where to send the news (defaults to current channel if not provided)"
}];
export { appsOnly as autocomplete } from "../autocomplete/search.js";
export async function run(inter)
{
	const channel = inter.options.getChannel("channel")
		|| await inter.guild.channels.fetch(inter.channelId);
	const perms = channel.permissionsFor(await inter.guild.members.fetchMe());
	const t = tr.set(inter.locale, "watch");

	if(!perms?.has(SEND_MESSAGES))
		return inter.reply({ephemeral: true, content: t("cannot-send", channel)});
	else if(!perms.has(EMBED_LINKS))
		return inter.reply({ephemeral: true, content: t("cannot-embed", channel)});

	const { appid, defer } = await interpretAppidOption(inter, true);
	if(!appid)
		return;
	else if(+appid === STEAM_APPID)
		return defer.then(() => inter.editReply({ephemeral: true, content: tr.get(inter.locale, "no-match", appid)}));

	const LIMIT = (voted(inter.user.id) ? LIMIT_WITH_VOTE : WATCH_LIMIT)
		+ (inter.entitlements.find(({skuId}) => skuId === premiumSKU) ? PREMIUM_BONUS : 0);
	const role = inter.options.getRole("role")?.id;
	const type = inter.options.getString("type");
	const watchPrice = type === "price";

	const MAX_BONUS = WATCH_VOTE_BONUS + PREMIUM_BONUS;
	const errorReplaces = { LIMIT, MAX_BONUS, vote: voteURL(inter.locale) };

	watch(+appid, channel, role, watchPrice, LIMIT).then(async success => {
		await defer;
		const details = getAppInfo(appid);

		if(!details)
		{
			purgeApp(appid);
			return inter.editReply({ephemeral: true, content: t.get(inter.locale, "bad-appid")});
		}

		if(watchPrice)
		{
			if(success === null)
				return inter.editReply({ephemeral: true, content: t("price-free")});
			if(success === false)
				return inter.editReply({ephemeral: true, content: t("price-unknown")});
		}

		if(details.type === "dlc" && !watchPrice)
		{
			purgeApp(appid);
			return inter.editReply({ephemeral: true, content: t.get(inter.locale, "no-DLC-news")});
		}

		if(details.nsfw && !channel.nsfw)
		{
			unwatch(appid, inter.guild);
			return inter.editReply(tr.get(inter.locale, `NSFW-content-${type}`));
		}

		let reply = success
			? t(`confirm-${type}`, details.name, channel)
			: t(`already-${type}`, details.name);

		if(details.name === "undefined")
			reply += `\n${t("error-retrieving-details")}`;

		if(success === MAX_LIMIT)
			reply += `\n${t("server-max-reached", MAX_LIMIT)}`
		else if(success === LIMIT)
			reply += LIMIT === LIMIT_WITH_VOTE
				? `\n${t("server-limit-reached-voted", LIMIT)}`
				: `\n${t("server-limit-reached", errorReplaces)}`;

		updateUnwatch(inter.guild);
		inter.editReply(reply);
	}, async err => {
		await defer;
		if(err instanceof TypeError && err.message.includes("appid"))
			inter.editReply({ephemeral: true, content: tr.get(inter.locale, "bad-appid")});
		else if(err instanceof RangeError)
		{
			inter.editReply({ ephemeral: true, content:
				LIMIT === MAX_LIMIT ? t("error-limit-reached", MAX_LIMIT)
				: LIMIT === LIMIT_WITH_VOTE ? t("error-limit-reached-voted", LIMIT)
				: t("error-limit-reached", errorReplaces)
			});
		}
		else if(err instanceof HTTPError)
		{
			const { code } = err;
			inter.editReply({
				ephemeral: true,
				content: tr.get(inter.locale, code === 403 ? "api-403" : "api-err", code),
			});
		}
		else
		{
			error(err);
			inter.editReply({ephemeral: true, content: tr.get(inter.locale, "error")});
		}
	});
}
