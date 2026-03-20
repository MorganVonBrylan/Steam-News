
import checkSKU from "./~checkSKU.js";
import {
	getNonWebhooks,
	getWatcher,
	getChannelWebhooks,
	setWebhook,
	getAppName,
} from "../../../steam_news/db_api.js";
import { icon, STEAM_APPID } from "../../../steam_news/api.js";
import { formatWebhookInfo, Webhook } from "./~webhook.js";
import { ALL_WEBHOOKS } from "./~autocomplete.js";
import fetchImage from "../../../utils/fetchImage.js";
import { PermissionFlagsBits as PERMISSIONS } from "discord.js";
const MANAGE_WEBHOOKS = PERMISSIONS.ManageWebhooks;
import { FieldList, sendEmbeds } from "../../../utils/embeds.js";

let STEAMNEWS_ICON;
const ERROR = 0xAA0000;

export const description = "Set a watcher to use the provided webhook.";
export const options = [{
	type: STRING, name: "watcher", required: true,
	description: "The watcher to customize",
	autocomplete: true,
}];
export { autocompleteWithAll as autocomplete } from "./~autocomplete.js";
/** @param {import("discord.js").ChatInputCommandInteraction<"cached">} inter */
export async function run(inter)
{
	const t = tr.set(inter.locale, "premium.chameleon");
	if(!checkSKU(inter, t))
		return;

	await inter.deferReply();
	const { options, guildId, guild: { channels, members } } = inter;
	const me = await members.fetchMe();
	const target = options.getString("watcher");

	const webhookCache = new Map();

	const { user: { username, globalName } } = inter;
	const authorName = globalName ? `${globalName} (${username})` : username;
	const autoCreateReason = t("webhook-auto-create", authorName);
	STEAMNEWS_ICON ??= await fetchImage(inter.client.user.avatarURL()).catch(error);

	if(target === ALL_WEBHOOKS)
	{
		// It is tempting to use .map and Promise.allSettled,
		// However this can cause the creation of several webhooks for the same channel,
		// as one watcher can be processed while another's createWebhook() is being awaited.
		const results = [];
		for(const watcher of getNonWebhooks(guildId))
			results.push(await setupWebhook(watcher).then(success=>({success}), error=>({error})));
		const { successes, errors, miscErrors } = parseMassCreateResults(results);
		const fieldList = new FieldList();

		if(successes.size)
		{
			const fields = [];
			for(const [channelId, {webhook, newlyCreated, games}] of successes.entries())
			{
				const { name, id } = await Webhook.fetch(webhook);
				let text = `${t(newlyCreated ? "webhook-auto-created" : "webhook-auto-reused")} **${name}** (${id})`;

				if(games.length < 6)
					text += `\n${t("webhook-auto-for", {games: games.join(", ")})}`;
				else
					text += `\n${t("webhook-auto-forMany", {
						someGames: games.slice(0, 5).join(", "),
						number: games.length - 5,
					})}`;
				fields.push({ name: `<#${channelId}>`, value: text, inline: true });
			}

			fieldList.addGroup(fields, {
				title: t("webhook-auto-successes"),
				description: t("webhook-auto-explain"),
			});
		}
		if(errors.size || miscErrors.size)
		{
			const fields = [];
			for(const [error, channelIds] of errors.entries())
				fields.push({ name: t(error), value: `<#${channelIds.join("> <#")}>` });
			if(miscErrors.size)
				fields.push({ name: t("webhook-auto-errors"), value: miscErrors.join("\n") });

			fieldList.addGroup(fields, { color: ERROR, title: t("webhook-auto-failures") });
		}

		if(fieldList.length)
			sendEmbeds(fieldList, inter);
		else
			inter.editReply(t("webhook-auto-nothing", `</premium chameleon unset:${inter.commandId}>`));
	}
	else
	{
		const appid = +target.substring(1);
		const steam = appid === STEAM_APPID;
		const type = steam ? "steam" : target[0] === "n" ? "news" : "price";
		const watcher = getWatcher(type, { appid, guildId });
		if(!watcher)
			return inter.editReply(t("unknown-watcher"));

		watcher.type = type;
		setupWebhook(watcher).then(async res => {
			const webhookInfo = await Webhook.fetch(res.webhook);
			if("name" in webhookInfo)
			{
				const { id, name } = webhookInfo;
				const { channel, newlyCreated, name: nickname, avatar } = res;
				const latest = steam ? "steam-latest" : "latest";
				const latestId = inter.command?.manager.cache.find(({name}) => name === latest)?.id;
				const latestMention = latestId
					? `</${latest}:${latestId}>`
					: `\`/${tr.get(inter.locale, `commands.${latest}.name`)}\``;
					
				inter.editReply({embeds: [{
					thumbnail: { url: avatar },
					title: t(newlyCreated ? "webhook-auto-created" : "webhook-auto-reused"),
					description: `${t("webhook-auto-info", { name, id, nickname, avatar })}
					\n${type === "price"
						? t("webhook-auto-price")
						: t(steam ? "webhook-test-steam" : "webhook-test",
							{ channel, latest: latestMention })}`
				}]});
			}
			else
			{
				const { message, code } = webhookInfo;
				inter.editReply(t("auto-create-error", `${message} (${code})`));
			}
		}, err => {
			const knownError = typeof err.key === "string";
			if(!knownError)
				error(err);
			inter.editReply({embeds: [{
				color: ERROR,
				description: knownError ? t(err.key) : t("auto-create-error", err.message),
			}]});
		});
	}


	/** @typedef {import("../../../utils/channels.js").GuildTextChannel} GuildTextChannel */
	/**
	 * @param {ReturnType<getWatcher>} watcher The watcher to setup a webhook for
	 * @returns {Promise<{webhook:`${bigint}/${string}`, channel:GuildTextChannel, name:string, avatar:?string,newlyCreated:boolean}>}
	 */
	async function setupWebhook(watcher) {
		const channel = await channels.fetch(watcher.channelId);
		const isThread = channel?.isThread();
		const webhookChannel = isThread
			? channel.parent || await channels.fetch(channel.parentId)
			: channel;
		if(!webhookChannel)
			throw { key: "channel-not-found", channel: channel || watcher.channelId };

		const { id: channelId } = webhookChannel;
		let newlyCreated = false;
		if(!webhookCache.has(channelId))
		{
			const existingWebhook = getChannelWebhooks(channelId)?.[0];
			webhookCache.set(channelId, existingWebhook || await createWebhook(channel));
			if(!existingWebhook)
				newlyCreated = true;
		}

		const webhook = webhookCache.get(channelId);
		const { appid = STEAM_APPID } = watcher;
		const name = getAppName(appid);
		const avatar = await icon(appid);
		watcher.webhook = formatWebhookInfo(webhook, isThread, name, avatar);
		if(!setWebhook(watcher.type, watcher))
			throw { key: "database-fail", channel: webhookChannel };

		return { webhook, channel: webhookChannel, name, avatar, newlyCreated };
	}

	/** @param {GuildTextChannel} channel The channel */
	async function createWebhook(channel) {
		if(!channel.permissionsFor(me).has(MANAGE_WEBHOOKS))
			throw { key: "missing-permissions", channel };

		const { id, token } = await channels.createWebhook({
			channel: channel.id, reason: autoCreateReason,
			avatar: STEAMNEWS_ICON, name: "Steam News",
		});
		const idAndToken = `${id}/${token}`;
		webhookCache.set(channel, idAndToken);
		return idAndToken;
	}


	/** @param {({success:Awaited<ReturnType<setupWebhook>>}|{error: Error|{key:string,channel:string[GuildTextChannel]}})[]} results */
	function parseMassCreateResults(results)
	{
		/** @typedef {string} ChannelId */
		/** @typedef {string} ErrorMessage */

		/** @type {Map<ChannelId, Omit<Awaited<ReturnType<setupWebhook>>, "name"|"avatar"> & { games:string[] }>} */
		const successes = new Map();

		/** @type {Map<ErrorMessage, Set<ChannelId>>} */
		const errors = new Map();

		/** @type {Set<ErrorMessage>} */
		const miscErrors = new Set();
		
		for(const res of results)
		{
			if(res.success)
			{
				const { webhook, channel, name, newlyCreated } = res.success;
				const success = successes.get(channel.id);
				if(success)
				{
					success.games.push(name);
					success.newlyCreated ||= newlyCreated;
				}
				else
					successes.set(channel.id, { channel, webhook, newlyCreated, games: [name] });
			}
			else if(res.error instanceof Error)
			{
				console.error(res.error);
				miscErrors.add(res.error.message);
			}
			else
			{
				const { key, channel } = res.error;
				const channelId = channel?.id || channel;
				const channels = errors.get(key);
				if(channels)
					channels.add(channelId);
				else
					errors.set(key, new Set([channelId]));
			}
		}

		return { successes, errors, miscErrors };
	}
}
