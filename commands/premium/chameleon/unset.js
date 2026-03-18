
import checkSKU from "./~checkSKU.js";
import { getWatcherChannel, setWebhook, decoupleWebhooks } from "../../../steam_news/db_api.js";
import { STEAM_APPID } from "../../../steam_news/api.js";
import { ALL_WEBHOOKS } from "./~autocomplete.js";

export const description = "Decouple a watcher from its webhook. This does not delete the webhook.";
export const options = [{
	type: STRING, name: "watcher", required: true,
	description: "The watcher to customize",
	autocomplete: true,
}];
export { autocompleteWebhooks as autocomplete } from "./~autocomplete.js";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "premium.chameleon");
	if(!checkSKU(inter, t))
		return;

	const { options, guildId } = inter;
	const watcher = options.getString("watcher");
	if(watcher === ALL_WEBHOOKS)
		return inter.reply(t(decoupleWebhooks(guildId) ? "all-decoupled" : "nothing-decoupled"));

	await inter.deferReply();
	const appid = +watcher.substring(1);
	const type = appid === STEAM_APPID ? "steam" : watcher[0] === "n" ? "news" : "price";
	const channelId = getWatcherChannel(type, { appid, guildId });
	if(!channelId)
		return inter.editReply(t("unknown-watcher"));

	inter.editReply(t(
		setWebhook(type, { appid, channelId, webhook: null })
		? (type === "price" ? "webhook-unset-price" : "webhook-unset")
		: "webhook-unset-error"
	));
}