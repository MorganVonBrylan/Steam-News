
import checkSKU from "./~checkSKU.js";
import { parseWebhookInfo, formatWebhookInfo } from "./~webhook.js";
import { getWatcher, setWebhook } from "../../../steam_news/db_api.js";
import { STEAM_APPID } from "../../../steam_news/api.js";

export const description = "Customize a webhook.";

import { options as setOptions } from "./set.js";
export const options = structuredClone(setOptions).filter(({name}) => name !== "webhook-url");
options.find(({name}) => name === "name").required = true;

import { autocompleteWebhooks, parseOption } from "./~autocomplete.js";
export function autocomplete(inter) { autocompleteWebhooks(inter, false); }

export async function run(inter)
{
	if(!checkSKU(inter))
		return;
	const t = tr.set(inter.locale, "premium.chameleon");

	await inter.deferReply();
	const { options, guildId } = inter;
	const { appid, type } = parseOption(options.getString("watcher"));
	const { channelId, webhook } = getWatcher(type, { appid, guildId });
	if(!channelId || !webhook)
		return inter.editReply(t("unknown-watcher"));

	const { idAndToken, thread: isThread } = parseWebhookInfo(webhook);
	const username = options.getString("name");
	const avatar = options.getString("avatar");
	const newWebhook = formatWebhookInfo(idAndToken, isThread, username, avatar);
	
	inter.editReply(t(
		setWebhook(type, { appid, clanid: appid, channelId, webhook: newWebhook })
		? "webhook-customized"
		: "webhook-customize-error"
	));
}