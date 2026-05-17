
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
import fetchImage from "../../../utils/fetchImage.function.js";
import { PermissionFlagsBits as PERMISSIONS } from "discord.js";
const MANAGE_WEBHOOKS = PERMISSIONS.ManageWebhooks;
import { FieldList, sendEmbeds } from "../../../utils/embeds.js";

import { client } from "../../../bot.js";
import { mention as mentionCommand } from "../../../utils/commands.js";

const STEAMNEWS_ICON = await fetchImage(client.user.avatarURL()).catch(error);
const ERROR = 0xAA0000;

export const description = "Automatically customize a watcher's webhook.";
export const options = [{
	type: STRING, name: "watcher", required: true,
	description: "The watcher to customize",
	autocomplete: true,
}];
export { autocompleteWithAll as autocomplete } from "./~autocomplete.js";
/** @param {import("discord.js").ChatInputCommandInteraction<"cached">} inter */
export async function run(inter)
{
	if(!checkSKU(inter))
		return;
	const t = tr.set(inter.locale, "premium.chameleon");

	await inter.deferReply();
	const { options, guildId, guild } = inter;
	const target = options.getString("watcher");
	const webhooks = new WebhookAutoSetter(guild, inter.user, await guild.members.fetchMe());

	if(target === ALL_WEBHOOKS)
	{
		const { successes, errors, miscErrors } = await webhooks.bulkSetup(getNonWebhooks(guildId));
		const fieldList = new FieldList();

		if(successes.size)
		{
			const fields = [];
			for(const [channelId, {webhook, newlyCreated, games: gameList}] of successes.entries())
			{
				const { name, id } = await Webhook.fetch(webhook);
				let text = `${t(newlyCreated ? "webhook-auto-created" : "webhook-auto-reused")} **${name}** (${id})`;

				const games = Array.from(gameList);
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
		webhooks.setup(watcher).then(async res => {
			const webhookInfo = await Webhook.fetch(res.webhook);
			if("name" in webhookInfo)
			{
				const { id, name } = webhookInfo;
				const { channel, newlyCreated, name: nickname, avatar } = res;
				inter.editReply({embeds: [{
					thumbnail: { url: avatar },
					title: t(newlyCreated ? "webhook-auto-created" : "webhook-auto-reused"),
					description: `${t("webhook-auto-info", { name, id, nickname, avatar })}
					\n${type === "price"
						? t("webhook-auto-price")
						: t(steam ? "webhook-test-steam" : "webhook-test",
							{ channel, latest: mentionLatest(inter, type) })}`
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
}


/**
 * Mention the appropriate /latest command.
 * @param {import("discord.js").ChatInputCommandInteraction} inter The interaction
 * @param {"news"|"steam"} type The watcher type
 * @returns 
 */
export function mentionLatest({locale, guildId}, type)
{
	const sub = type === "steam" ? "steam-news" : "game-news";
	return mentionCommand("latest", { sub, guildId })
		|| `\`/latest ${tr.get(locale, `commands.latest.options.${sub}.name`)}\``;
}


/** @typedef {import("../../../utils/channels.js").GuildTextChannel} GuildTextChannel */
/** @typedef {import("./~webhook.js").idAndToken} idAndToken */

/**
 * Utility class for setting up webhooks in a given server.
 */
export class WebhookAutoSetter
{
	/** @type {Map<string, string>} A channelId-to-idAndToken store */
	webhookCache = new Map();
	
	/**
	 * @param {import("discord.js").Guild} guild The guild 
	 * @param {import("discord.js").User} author The author
	 * @param {import("discord.js").GuildMember} [me] The bot's member object
	 */
	constructor(guild, author, me) {
		const { username, globalName } = author;
		const authorName = globalName ? `${globalName} (${username})` : username;
		this.reason = tr.get(guild.preferredLocale, "premium.chameleon.webhook-auto-create", authorName);
		this.channels = guild.channels;
		this.me = me || guild.members.me;
	}
	
	/**
	 * Setup a customized webhook for the provided watcher.
	 * @param {ReturnType<getWatcher>} watcher The watcher to setup a webhook for
	 * @param {idAndToken} [idAndToken] The webhook to use. If not provided, it will either reuse one this watcher's channel already has, or create a new one.
	 * @returns {Promise<{webhook:idAndToken, channel:GuildTextChannel, name:string, avatar:?string,newlyCreated:boolean}>}
	 * @throws {{key:string, channel:GuildTextChannel|string}} If the channel doesn't exist or updating the database failed
	 */
	async setup(watcher, idAndToken) {
		const channel = await this.channels.fetch(watcher.channelId);
		const isThread = channel?.isThread();
		const webhookChannel = isThread
			? channel.parent || await this.channels.fetch(channel.parentId)
			: channel;
		if(!webhookChannel)
			throw { key: "channel-not-found", channel: channel || watcher.channelId };

		const { id: channelId } = webhookChannel;
		let newlyCreated = false;
		if(!this.webhookCache.has(channelId))
		{
			if(idAndToken)
				this.webhookCache.set(channelId, idAndToken);
			else
			{
				const existingWebhook = getChannelWebhooks(channelId)?.[0];
				this.webhookCache.set(channelId,
					existingWebhook || await this.create(webhookChannel)
				);
				if(!existingWebhook)
					newlyCreated = true;
			}
		}

		const webhook = idAndToken || this.webhookCache.get(channelId);
		const { appid = STEAM_APPID } = watcher;
		const name = getAppName(appid);
		const avatar = await icon(appid, { officialFirst: false });
		watcher.webhook = formatWebhookInfo(webhook, isThread, name, avatar);
		if(!setWebhook(watcher.type, watcher))
			throw { key: "database-fail", channel: webhookChannel };

		return { webhook, channel: webhookChannel, name, avatar, newlyCreated };
	}

	/**
	 * Create a new webhook.
	 * @param {GuildTextChannel} channel The channel
	 * @returns The new webhook's id/token
	 * @throws {{key:string,channel:GuildTextChannel}} If the bot's permissions are insufficient
	 */
	async create(channel) {
		if(!channel.permissionsFor(this.me).has(MANAGE_WEBHOOKS))
			throw { key: "missing-permissions", channel };

		const { id, token } = await this.channels.createWebhook({
			channel: channel.id, reason: this.reason,
			avatar: STEAMNEWS_ICON, name: "Steam News",
		});
		const idAndToken = `${id}/${token}`;
		this.webhookCache.set(channel, idAndToken);
		return idAndToken;
	}

	/**
	 * Sets up webhooks for many watchers.
	 * @param {ReturnType<getWatcher>[]} watchers 
	 * @returns The successes, errors, or "misc errors" which are unexpected errors
	 */
	async bulkSetup(watchers) {
		/** @typedef {string} ChannelId */
		/** @typedef {string} ErrorMessage */

		/** @type {Map<ChannelId, Omit<Awaited<ReturnType<setupWebhook>>, "name"|"avatar"> & { games:Set<string> }>} */
		const successes = new Map();

		/** @type {Map<ErrorMessage, Set<ChannelId>>} */
		const errors = new Map();

		/** @type {Set<ErrorMessage>} */
		const miscErrors = new Set();
		
		// It is tempting to use .map and Promise.allSettled,
		// However this can cause the creation of several webhooks for the same channel,
		// as one watcher can be processed while another's createWebhook() is being awaited.
		for(const watcher of watchers) try
		{
			const { webhook, channel, name, newlyCreated } = await this.setup(watcher);
			const success = successes.get(channel.id);
			if(success)
			{
				success.games.add(name);
				success.newlyCreated ||= newlyCreated;
			}
			else
				successes.set(channel.id, { channel, webhook, newlyCreated, games: new Set([name]) });
		}
		catch(error)
		{
			if(error instanceof Error)
			{
				console.error(error);
				miscErrors.add(error.message);
			}
			else
			{
				const { key, channel } = error;
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
