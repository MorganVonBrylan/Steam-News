
import checkSKU from "./~checkSKU.js";
import { webhookInfo } from "./~webhook.js";
import { getWatcherChannel, setWebhook, getAppName } from "../../../steam_news/db_api.js";
import { icon, STEAM_APPID } from "../../../steam_news/api.js";
import { buttons, register } from "../../../utils/components.js";

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
	if(!checkSKU(inter))
		return;
	const t = tr.set(inter.locale, "premium.chameleon");

	await inter.deferReply();
	const { options, guildId } = inter;
	const watcher = options.getString("watcher");
	const appid = +watcher.substring(1);
	const steam = appid === STEAM_APPID;
	const type = steam ? "steam" : watcher[0] === "n" ? "news" : "price";
	const webhookUrl = options.getString("webhook-url");
	const channelId = getWatcherChannel(type, { appid, guildId });
	if(!channelId)
		return inter.editReply(t("unknown-watcher"));

	const channel = await inter.guild.channels.fetch(channelId);
	const webhookChannel = channel.isThread() ? channel.parent : channel;

	const name = options.getString("name");
	const avatar = options.getString("avatar");

	webhookInfo(webhookUrl, channel, name, avatar)
	.then(webhook => {
		const success = setWebhook(type, { appid, channelId, webhook });
		const latest = steam ? "steam-latest" : "latest";
		const latestId = inter.command?.manager.cache.find(({name}) => name === latest)?.id;
		const baseMessage = success
			? (type === "price"
				? t("webhook-set-price")
				: `${t("webhook-set")}\n${t(steam ? "webhook-test-steam" : "webhook-test", {
					channel: webhookChannel,
					latest: latestId
						? `</${latest}:${latestId}>`
						: `\`/${tr.get(inter.locale, `commands.${latest}.name`)}\``,
				})}`)
			: t("webhook-set-error");
		const message = { embeds: [{ description: baseMessage }]};

		if(success && !name && !avatar)
		{
			const customId = inter.id;
			message.embeds[0].description += `\n\n${t("webhook-set-suggestAuto")}`;
			message.components = [buttons({customId, label: t("webhook-set-auto")})];
			register(customId, async () => {
				const name = getAppName(appid);
				const avatar = await icon(appid);
				const webhook = await webhookInfo(webhookUrl, channel, name, avatar);
				const success = setWebhook(type, { appid, channelId, webhook });
				inter.editReply({ embeds: [{
					description: baseMessage,
					footer: { text: t(success ? "webhook-set-autoset" : "webhook-autoset-error") },
				}], components: []});
			}, { singleUse: true, timeoutCallback() {
				inter.editReply({ embeds: [{description: baseMessage}], components: [] });
			} });
		}
		
		inter.editReply(message);
	}, err => {
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