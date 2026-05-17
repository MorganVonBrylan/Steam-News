
import { STEAM_APPID } from "../../steam_news/api.js";
import { interpretAppidOption } from "../../utils/commands.js";

import { WATCH_LIMIT, WATCH_VOTE_BONUS, WATCH_PREMIUM_BONUS } from "../../steam_news/limits.js";
const LIMIT_WITH_VOTE = WATCH_LIMIT + WATCH_VOTE_BONUS;
import {
	voted,
	premiumSKU, goldSKU, buttons,
	premiumGuilds, chameleonGuilds,
} from "../../steam_news/VIPs.js";
const premiumButton = buttons(premiumSKU, goldSKU);
const MAX_LIMIT = LIMIT_WITH_VOTE + WATCH_PREMIUM_BONUS;
import { voteURL } from "../../botLists.js";

import { watch, unwatch, getAppInfo, purgeApp } from "../../steam_news/watchers.js";
import { HTTPError } from "../../steam_news/api.js";
import { autoSuggestButton } from "../premium/chameleon/set.js";

import { options as baseOptions, checkPerms, updateWebhook } from "./~commons.js"

import { updateCmd as updateUnwatch } from "../~guild/unwatch.js";

export const defaultMemberPermissions = "0";
export const options = [{
	type: STRING, name: "type", required: true,
	description: "Whether to watch news or price changes",
	choices: [{name: "News", value: "news"}, {name: "Price", value: "price"}],
}, {
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
},
	...baseOptions,
];
export { appsOnly as autocomplete } from "../../autocomplete/search.js";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const { locale, options, guild } = inter;
	const t = tr.set(locale, "watch");
	const channel = options.getChannel("channel")
		|| await guild.channels.fetch(inter.channelId);

	const cannotSend = await checkPerms(channel);
	if(cannotSend)
		return inter.reply({flags: "Ephemeral", content: t(cannotSend, channel.toString())});

	const { appid, defer } = await interpretAppidOption(inter, true);
	if(!appid) // interpretAppidOption already replied
		return;
	else if(+appid === STEAM_APPID)
		return defer.then(() => inter.editReply({flags: "Ephemeral", content: tr.get(locale, "no-match", appid)}));

	const role = options.getRole("role")?.id;
	const type = options.getString("type");
	const watchPrice = type === "price";

	const LIMIT = (voted(inter.user.id) ? LIMIT_WITH_VOTE : WATCH_LIMIT)
		+ (premiumGuilds.has(guild.id) ? WATCH_PREMIUM_BONUS : 0);
	const MAX_BONUS = WATCH_VOTE_BONUS + WATCH_PREMIUM_BONUS;
	const errorReplaces = { LIMIT, MAX_BONUS, vote: voteURL(locale) };

	watch(+appid, channel, role, watchPrice, LIMIT).then(async success => {
		await defer;
		const details = getAppInfo(appid);

		if(!details)
		{
			purgeApp(appid);
			return inter.editReply({flags: "Ephemeral", content: t.get(locale, "bad-appid")});
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
			return inter.editReply({flags: "Ephemeral", content: t.get(locale, "no-DLC-news")});
		}

		if(details.nsfw && !channel.nsfw)
		{
			unwatch(appid, guild);
			return inter.editReply(tr.get(locale, `NSFW-content-${type}`));
		}

		let reply = t(`confirm-${type}`, {name: details.name, channel});

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

		updateUnwatch(guild);
		if(!success.webhook && chameleonGuilds.has(guild.id))
		{
			const t = tr.set(locale, "premium.chameleon");
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
			inter.editReply({flags: "Ephemeral", content: tr.get(locale, "bad-appid")});
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
				content: tr.get(locale, code === 403 ? "api-403" : "api-err", code),
			});
		}
		else
		{
			error(err);
			inter.editReply({flags: "Ephemeral", content: tr.get(locale, "error")});
		}
	});
}
