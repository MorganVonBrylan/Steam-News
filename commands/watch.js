
import { STEAM_APPID } from "../steam_news/api.js";
import { interpretAppidOption } from "../utils/commands.js";

import { WATCH_LIMIT, WATCH_VOTE_BONUS, WATCH_PREMIUM_BONUS } from "../steam_news/limits.js";
const LIMIT_WITH_VOTE = WATCH_LIMIT + WATCH_VOTE_BONUS;
import {
	voted,
	premiumSKU, goldSKU, buttons,
	premiumGuilds, chameleonGuilds,
} from "../steam_news/VIPs.js";
const premiumButton = buttons(premiumSKU, goldSKU);
const MAX_LIMIT = LIMIT_WITH_VOTE + WATCH_PREMIUM_BONUS;
import { voteURL } from "../botLists.js";

import { watch, unwatch, getAppInfo, purgeApp } from "../steam_news/watchers.js";
import { HTTPError } from "../steam_news/api.js";
import { setWebhook } from "../steam_news/db_api.js";
import { fetchThreads } from "../utils/channels.js";
import { autoSuggestButton } from "./premium/chameleon/set.js";

import { PermissionFlagsBits } from "discord.js";
const {
	ViewChannel: VIEW_CHANNEL,
	SendMessages: SEND_MESSAGES,
	SendMessagesInThreads: SEND_MESSAGES_IN_THREADS,
	EmbedLinks: EMBED_LINKS,
} = PermissionFlagsBits;

import { guildCommands } from "@brylan/djs-commands";
const updateUnwatch = guildCommands.updateCmd.bind(null, "unwatch");


export async function checkPerms(channel)
{
	
	const perms = channel.permissionsFor(await channel.guild.members.fetchMe());
	if(!perms.has(VIEW_CHANNEL))
		return "cannot-see";
	else if(!perms?.has(channel.isThread() ? SEND_MESSAGES_IN_THREADS : SEND_MESSAGES))
		return "cannot-send";
	else if(!perms.has(EMBED_LINKS))
		return "cannot-embed";
}

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
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "watch");
	const channel = inter.options.getChannel("channel")
		|| await inter.guild.channels.fetch(inter.channelId);

	const cannotSend = await checkPerms(channel);
	if(cannotSend)
		return inter.reply({flags: "Ephemeral", content: t(cannotSend, channel.toString())});

	const { appid, defer } = await interpretAppidOption(inter, true);
	if(!appid)
		return;
	else if(+appid === STEAM_APPID)
		return defer.then(() => inter.editReply({flags: "Ephemeral", content: tr.get(inter.locale, "no-match", appid)}));

	const LIMIT = (voted(inter.user.id) ? LIMIT_WITH_VOTE : WATCH_LIMIT)
		+ (premiumGuilds.has(inter.guildId) ? WATCH_PREMIUM_BONUS : 0);
	const role = inter.options.getRole("role")?.id;
	const type = inter.options.getString("type");
	const watchPrice = type === "price";

	const MAX_BONUS = WATCH_VOTE_BONUS + WATCH_PREMIUM_BONUS;
	const errorReplaces = { LIMIT, MAX_BONUS, vote: voteURL(inter.locale) };

	watch(+appid, channel, role, watchPrice, LIMIT).then(async success => {
		await defer;
		const details = getAppInfo(appid);

		if(!details)
		{
			purgeApp(appid);
			return inter.editReply({flags: "Ephemeral", content: t.get(inter.locale, "bad-appid")});
		}

		if(watchPrice)
		{
			if(success === null)
				return inter.editReply({flags: "Ephemeral", content: t("price-free")});
			if(success === false)
				return inter.editReply({flags: "Ephemeral", content: t("price-unknown")});
		}

		if(details.type === "dlc" && !watchPrice)
		{
			purgeApp(appid);
			return inter.editReply({flags: "Ephemeral", content: t.get(inter.locale, "no-DLC-news")});
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
		{
			reply += LIMIT === LIMIT_WITH_VOTE
				? `\n${t("server-limit-reached-voted", LIMIT)}`
				: `\n${t("server-limit-reached", errorReplaces)}`;
			if(premiumButton)
				reply = { content: reply, components: [premiumButton] };
		}
		else if(typeof success === "object" && success.webhook)
			if(await updateWebhook(success, channel, type) === null)
				reply += `\n${t("webhook-auto-unset")}`;

		updateUnwatch(inter.guild);
		if(!success.webhook && chameleonGuilds.has(inter.guildId))
		{
			const t = tr.set(inter.locale, "premium.chameleon");
			const baseReply = reply;
			reply = {
				content: `${reply}\n\n${t("watch-suggestAuto")}`,
				components: autoSuggestButton(t,
					{ type, appid, channelId: channel.id },
					inter,
					result => inter.editReply({
						content: result ? `${baseReply}\n-# ${result}` : baseReply,
						components: [],
					}),
				),
			}
		}
		inter.editReply(reply);
	}, async err => {
		await defer;
		if(err instanceof TypeError && err.message.includes("appid") || err.message.includes(appid))
			inter.editReply({flags: "Ephemeral", content: tr.get(inter.locale, "bad-appid")});
		else if(err instanceof RangeError)
		{
			inter.editReply({ flags: "Ephemeral", content:
				LIMIT === MAX_LIMIT ? t("error-limit-reached", MAX_LIMIT)
				: LIMIT === LIMIT_WITH_VOTE ? t("error-limit-reached-voted", LIMIT)
				: t("error-limit-reached", errorReplaces),
				components: premiumButton ? [premiumButton] : undefined,
			});
		}
		else if(err instanceof HTTPError)
		{
			const { code } = err;
			inter.editReply({
				flags: "Ephemeral",
				content: tr.get(inter.locale, code === 403 ? "api-403" : "api-err", code),
			});
		}
		else
		{
			error(err);
			inter.editReply({flags: "Ephemeral", content: tr.get(inter.locale, "error")});
		}
	});
}


/**
 * Update the webhook after
 * @param {{appid:string, channelId:string, webhook:string}} oldWatcher The previous watcher data
 * @param {import("../utils/channels.js").GuildTextChannel} channel The current watcher channel
 * @param {"news"|"price"|"steam"} type The watcher type
 * @returns {Promise<?boolean>} flase if no update was needed (the channel is the same, or there is no webhook), true if the webhook was updated, null if it had to be removed
 */
export async function updateWebhook({appid, channelId: oldChannel, webhook}, channel, type = "news")
{
	const { id: channelId } = channel;
	if(!webhook || oldChannel === channelId)
		return false;

	if(channel.isThread())
	{
		if(channel.parentId === oldChannel)
		{
			const separator = webhook.indexOf("#", 50);
			if(separator === -1)
				webhook += "#t";
			else
				webhook = `${webhook.slice(0, separator)}#t${webhook.slice(separator)}`;
		}
		else
		{
			const siblings = await fetchThreads(channel);
			if(!siblings.includes(oldChannel))
				webhook = null;
		}
	}
	else if((await fetchThreads(channel)).includes(oldChannel))
		webhook = webhook.replace("#t", "");
	else
		webhook = null;

	setWebhook(type, { appid, channelId, webhook });
	return webhook ? true : null;
}
