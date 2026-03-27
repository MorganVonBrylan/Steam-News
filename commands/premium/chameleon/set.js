
import checkSKU from "./~checkSKU.js";
import { webhookInfo } from "./~webhook.js";
import { getWatcherChannel, setWebhook, getAppName } from "../../../steam_news/db_api.js";
import { icon, STEAM_APPID } from "../../../steam_news/api.js";
import { buttons, register } from "../../../utils/components.js";
import { WebhookAutoSetter } from "./auto.js";

const MAX_SIZE = 3_000_000;

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
	if(avatar)
	{
		const res = await fetch(avatar, { method: "HEAD" }).catch(() => null);
		if(!res?.ok)
			return inter.editReply(t("invalid-avatar-url"));
		const { headers } = res;
		if(!headers.get("content-type")?.startsWith("image/"))
			return inter.editReply(t("not-an-image"));
		if(!(headers.get("content-length") <= MAX_SIZE))
			return inter.editReply(t("too-large"));
	}

	webhookInfo(webhookUrl, channel, name, avatar)
	.then(webhook => {
		const watcher = { type, appid, channelId, webhook };
		const success = setWebhook(type, watcher);
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
			message.embeds[0].description += `\n\n${t("webhook-set-suggestAuto")}`;
			message.components = autoSuggestButton(t, watcher, inter, result => {
				inter.editReply({
					embeds: [result ? {
						description: baseMessage,
						footer: { text: result },
					} : {
						description: baseMessage,
					}],
					components: [],
				});
			}, webhook.split("#", 1)[0]);
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

/**
 * Get a button that allows auto-customizing a watchers.
 * @param {(key:string)=>string} t A translation function set to the premium.chameleon group
 * @param {{type:"news"|"price"|"steam", appid:number, channelId:string, webhook?:string }} watcher The watcher data
 * @param {import("discord.js").ChatInputCommandInteraction} inter The interaction
 * @param {(result:string)=>*} callback A function to execute on button action. Will include a result message if the button is clicked, undefined if the button times out.
 * @param {import("./~webhook.js").idAndToken} [idAndToken] The id/token of the webhook to use. If unset, one will be reused or created.
 * @returns A component list.
 */
export function autoSuggestButton(t, watcher, inter, callback, idAndToken)
{
	const customId = inter.id;
	const button = buttons({customId, label: t("webhook-set-auto")});
	register(customId, async () => {
		const { guild } = inter;
		const me = await guild.members.fetchMe();
		const webhookSetter = new WebhookAutoSetter(guild, inter.user, me);
		try {
			await webhookSetter.setup(watcher, idAndToken);
			callback(t("webhook-set-autoset"));
		} catch(err) {
			console.error(err instanceof Error ? err : err.key);
			callback(t("webhook-set-autoset-error"));
		}
	}, {
		singleUse: true,
		timeoutCallback: callback,
	});
	return [button];
}