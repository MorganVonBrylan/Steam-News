
import checkSKU from "./~checkSKU.js";
import { parseWebhookInfo, formatWebhookInfo } from "./~webhook.js";
import { getWatcher, setWebhook } from "../../../steam_news/db_api.js";
import { STEAM_APPID } from "../../../steam_news/api.js";

export const description = "Customize a webhook.";

import { options as setOptions } from "./set.js";
export const options = structuredClone(setOptions).filter(({name}) => name !== "webhook-url");
options.find(({name}) => name === "name").required = true;

import { autocompleteWebhooks } from "./~autocomplete.js";
export function autocomplete(inter) { autocompleteWebhooks(inter, false); }

export async function run(inter)
{
	if(!checkSKU(inter))
		return;
	const t = tr.set(inter.locale, "premium.chameleon");

	await inter.deferReply();
	const { options, guildId } = inter;
	const watcher = options.getString("watcher");
	const appid = +watcher.substring(1);
	const type = appid === STEAM_APPID ? "steam" : watcher[0] === "n" ? "news" : "price";
	const { channelId, webhook } = getWatcher(type, { appid, guildId });
	if(!channelId || !webhook)
		return inter.editReply(t("unknown-watcher"));

	const { idAndToken, thread: isThread } = parseWebhookInfo(webhook);
	const username = options.getString("name");
	const avatar = options.getString("avatar");
	const newWebhook = formatWebhookInfo(idAndToken, isThread, username, avatar);
	
	inter.editReply(t(
		setWebhook(type, { appid, channelId, webhook: newWebhook })
		? "webhook-customized"
		: "webhook-customize-error"
	));
}