
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

import { watchGroup, unwatchGroup } from "../../steam_news/watchers.js";
import { getBasicGroupDetails, HTTPError } from "../../steam_news/api.js";
import { setWebhook } from "../../steam_news/db_api.js";
import { fetchThreads } from "../../utils/channels.js";
import { autoSuggestButton } from "../premium/chameleon/set.js";

import { options as baseOptions, checkPerms, updateWebhook } from "./~commons.js"
import { getNameOrId, options as groupOptions } from "../group.js";

import { updateCmd as updateUnwatch } from "../~guild/unwatch.js";

export const defaultMemberPermissions = "0";
export const options = [
	groupOptions[0],
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

	const defer = inter.deferReply();
	const details = await getBasicGroupDetails(getNameOrId(inter.options.getString("group")));
	if(!details)
	{
		const delay = 20;
		inter.editReply({flags: "Ephemeral", content: tr.get(locale, "group.invalidGroup", delay)});
		setTimeout(() => inter.deleteReply(), delay * 1000);
		return;
	}

	const role = inter.options.getRole("role")?.id;

	const LIMIT = (voted(inter.user.id) ? LIMIT_WITH_VOTE : WATCH_LIMIT)
		+ (premiumGuilds.has(guild.id) ? WATCH_PREMIUM_BONUS : 0);
	const MAX_BONUS = WATCH_VOTE_BONUS + WATCH_PREMIUM_BONUS;
	const errorReplaces = { LIMIT, MAX_BONUS, vote: voteURL(locale) };

	watchGroup(details, channel, role, LIMIT).then(async success => {
		await defer;

		let reply = t("confirm-posts", {name: details.group_name, channel});

		if(success === MAX_LIMIT)
			reply += `\n${t("server-max-groups-reached", MAX_LIMIT)}`
		else if(success === LIMIT)
		{
			reply += LIMIT === LIMIT_WITH_VOTE
				? `\n${t("server-group-limit-reached-voted", LIMIT)}`
				: `\n${t("server-group-limit-reached", errorReplaces)}`;
			if(premiumButton)
				reply = { content: reply, components: [premiumButton] };
		}
		else if(typeof success === "object" && success.webhook)
			if(await updateWebhook(success, channel, "group") === null)
				reply += `\n${t("webhook-auto-unset")}`;

		updateUnwatch(guild);
		if(!success.webhook && chameleonGuilds.has(guild.id))
		{
			const t = tr.set(locale, "premium.chameleon");
			const baseReply = reply;
			reply = {
				content: `${reply}\n\n${t("watch-suggestAuto-group")}`,
				components: autoSuggestButton(t,
					{ type: "group", clanid: details.clanid, details, channelId: channel.id },
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
		if(err instanceof RangeError)
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
