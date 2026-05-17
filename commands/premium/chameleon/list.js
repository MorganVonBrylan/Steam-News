
import checkSKU from "./~checkSKU.js";
import { Webhook } from "./~webhook.js";
import { getWebhooks, purgeWebhook } from "../../../steam_news/db_api.js";
import paginate from "../../../utils/paginate.js";

const MAX_FIELDS_PER_EMBED = 25;

export const description = "See all webhooks set up in this server.";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	if(!checkSKU(inter))
		return;
    const t = tr.set(inter.locale, "premium.chameleon");

	await inter.deferReply();
	const webhooked = getWebhooks(inter.guildId)
		.map(({type, appid, clanid, name, channelId, webhook}) =>
		Object.assign(new Webhook(webhook), { type, appid, clanid, appName: name, channelId })
	);
	const webhookCache = Object.create(null);
	for(const idAndToken of new Set(webhooked.map(({idAndToken}) => idAndToken)))
	{
		const data = await fetchWebhook(idAndToken);
		if(data)
			webhookCache[idAndToken] = data;
	}

	const webhooks = webhooked.filter(({idAndToken}) => idAndToken in webhookCache);
	if(!webhooks.length)
		return inter.editReply({embeds: [{description: t("no-webhooks")}]});

	webhooks.sort(({appName, type}, {appName: bppName, type: btype}) => 
		type === "group" ? 200
		: btype === "group" ? -200
		: type === "steam" ? 100
		: btype === "steam" ? -100
		: appName !== bppName ? (appName < bppName ? 1 : -1)
		: type === "news" ? 1 : -1
	);

	const tTypes = {};
	for(const type of ["news", "price", "steam", "group"])
		tTypes[type] = t(type);
	const tWebhookName = t("webhook-name");
	const tUsername = t("name-used");
	const tAvatar = t("avatar-used");
	const title = t("webhooks");

	const fields = webhooks.map(({appName, threadId, idAndToken, type, username, avatar}) => {
		const { name, channel_id } = webhookCache[idAndToken];
		const channelId = threadId ?? channel_id;
		let value = `<#${channelId}>\n${tWebhookName.replace("%s", name)}`;
		if(username)
			value += `\n${tUsername.replace("%s", username)}`;
		if(avatar)
			value += `\n${tAvatar.replace("%s", avatar)}`;
		return { name: `${appName} (${tTypes[type]})`, value };
	});

	paginate(inter, {
		items: fields,
		pageLength: MAX_FIELDS_PER_EMBED,
		renderer: (fields) => ({ title, fields }),
	});
}

async function fetchWebhook(idAndToken)
{
	const url = Webhook.url(idAndToken);
	const res = await fetch(url);
	if(res.ok)
		return res.json();

	const { status, statusText } = res;
	if(status === 404)
	{
		purgeWebhook(idAndToken);
		return null;
	}
	
	const [id, token] = idAndToken.split("/");
	return {
		id, token, url,
		name: `Got error ${status} ${statusText} trying to fetch webhook data`,
		guild_id: "0",
		channel_id: "0",
		type: 1,
	};
}