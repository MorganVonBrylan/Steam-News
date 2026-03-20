
import checkSKU from "./~checkSKU.js";
import { webhookInfo } from "./~webhook.js";
import { getWatcherChannel, setWebhook } from "../../../steam_news/db_api.js";
import { STEAM_APPID } from "../../../steam_news/api.js";

export const description = "Set a watcher to use the provided webhook.";
export const options = [{
	type: STRING, name: "watcher", required: true,
	description: "The watcher to customize",
	autocomplete: true,
}, {
	type: STRING, name: "webhook-url", required: true,
	description: "The webhook to use",
	minLength: 100, maxLength: 150,
}, {
	type: STRING, name: "name",
	description: "Username to use for this game specifically",
	maxLength: 32,
}, {
	type: STRING, name: "avatar",
	description: "URL of the avatar to use for this game specifically",
	maxLength: 300,
}];
export { autocomplete } from "./~autocomplete.js";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "premium.chameleon");
	if(!checkSKU(inter, t))
		return;

	await inter.deferReply();
	const { options, guildId } = inter;
	const watcher = options.getString("watcher");
	const appid = +watcher.substring(1);
	const type = appid === STEAM_APPID ? "steam" : watcher[0] === "n" ? "news" : "price";
	const webhook = options.getString("webhook-url");
	const channelId = getWatcherChannel(type, { appid, guildId });
	if(!channelId)
		return inter.editReply(t("unknown-watcher"));

	const channel = await inter.guild.channels.fetch(channelId);
	const latest = appid === STEAM_APPID ? "steam-latest" : "latest";
	const latestId = inter.command?.manager.cache.find(({name}) => name === latest)?.id;
	const webhookChannel = channel.isThread() ? channel.parent : channel;

	webhookInfo(webhook, channel, options.getString("name"), options.getString("avatar"))
	.then(webhook => inter.editReply(
		setWebhook(type, { appid, channelId, webhook })
		? (type === "price"
			? t("webhook-set-price")
			: `${t("webhook-set")}\n${t("webhook-test", {
				channel: webhookChannel,
				latest: latestId
					? `</${latest}:${latestId}>`
					: `\`/${tr.get(inter.locale, `commands.${latest}.name`)}\``,
			})}`)
		: t("webhook-set-error")
	), err => {
		if(err.status)
			inter.editReply(t(err.message, err.status));
		else
		{
			inter.editReply(t(err.message));
			if(!(err instanceof RangeError) && !(err instanceof TypeError))
				error(err);
		}
	});
}