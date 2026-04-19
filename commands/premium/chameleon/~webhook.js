
import { purgeWebhook } from "../../../steam_news/db_api.js";

const webhookRegex = /^https:\/\/discord.com\/api\/webhooks\/([0-9]+\/[-\w]+)$/;

const codes = [["%", "%25"], ["#", "%23"], [":", "%3A"]];
const decodes = codes.toReversed();
function encodeComponent(component) {
	return codes.reduce((string, [char, code]) => string.replaceAll(char, code), component);
}
function decodeComponent(component) {
	return decodes.reduce((string, [char, code]) => string.replaceAll(code, char), component);
}

/** @typedef {`${bigint}/${string}`} idAndToken */
/** Standardised string representing webhook data, as stored in the database.
 * 
 * Conforms to the regex /^[0-9]+\/\w+(#t)?(#u:[^#]+)?(#a:[^#:]+)?$/
 * 
 * Which is (webhook id)/(webhook token)(#thread)(#u:username)(#a:avatar url) with each of the last 3 parts optional.
 * @typedef {`${idAndToken}${"#t"|""}${`#u:${string}`|""}${`#a:${string}`|""}`} WebhookInfo
 * */
export const webhookInfoRegex = /^[0-9]+\/\w+(#t)?(#u:[^#]+)?(#a:[^#:]+)?$/;


/**
 * Get a standardised string containing all the info for a watcher's webhook.
 * The returned format is a {@link WebhookInfo}
 * For the username and avatar URL, the percent, sharp and colon characters are encoded as with encodeURIComponent.
 * 
 * For example:
 * 12345/t0k3n#u:DRG News %23rockandstone#a:https%3A//somesite.net/drg.jpg
 * @param {string} url The webhook's URL, including the token but NOT including the thread_id.
 * @param {import("../../../utils/channels.js").GuildTextChannel} channel The channel or thread of the watcher
 * @param {string} [username] The username to use for this watcher
 * @param {string} [avatar] The avatar URL to use for this watcher
 * @returns {Promise<WebhookInfo>} Standardised string to save in the database and profice to Webhook's constructor
 * 
 * @throws {TypeError} if the provided url is not a Discord webhook URL
 * @throws {RangeError} if the webhook if for a different channel than the watcher's
 * @throws {Error} if the token is wrong, the webhook doesn't exist, or some other error. The error message will be a translation key.
 */
export async function webhookInfo(url, channel, username, avatar)
{
	const match = url.match(webhookRegex);
	if(!match)
		throw new TypeError("invalid-url");

	const res = await fetch(url);
	if(!res.ok)
	{
		const { status } = res;
		if(status === 401 || status === 403)
			throw new Error("wrong-token");
		else if(status === 404)
			throw new Error("not-found");
		else if(status >= 500)
			throw new Error("server-error");
		else
		{
			console.warn(new Date(), res);
			console.warn("Message:", await res.text());
			throw Object.assign(new Error("unknown-error"), {status:`${status} ${res.statusText}`});
		}
	}

	const idAndToken = match[1];
	const { channel_id } = await res.json();
	const isThread = channel_id === channel.parentId;
	if(!isThread && channel_id !== channel.id)
		throw new RangeError("wrong-channel");

	if(avatar)
	{
		const { ok } = await fetch(avatar, { method: "HEAD" }).catch(() => Object.null);
		if(!ok)
			avatar = null;
	}

	return formatWebhookInfo(idAndToken, isThread, username, avatar);
}

/**
 * Format webhook data as a string to easily store in the database.
 * @param {idAndToken} idAndToken The id/token of the webhook
 * @param {boolean} isThread Whether it is to be used in a thread.
 * @param {string} [username] The username to use for this watcher
 * @param {string} [avatar] The avatar URL to use for this watcher
 * @returns {WebhookInfo}
 */
export function formatWebhookInfo(webhook, isThread, username, avatar)
{
	if(isThread) webhook += "#t";
	if(username) webhook += `#u:${encodeComponent(username)}`;
	if(avatar) webhook += `#a:${encodeComponent(avatar)}`;
	return webhook;
}

/**
 * Get the individual components of a webhookInfo string.
 * @param {WebhookInfo} webhookInfo 
 * @returns {{idAndToken:string, thread:boolean, username?:string, avatar?:string}} The info
 */
export function parseWebhookInfo(webhookInfo)
{
	const [idAndToken, ...params] = webhookInfo.split("#");
	const infos = { idAndToken, thread: false };
	for(const param of params)
	{
		if(param === "t")
			infos.thread = true;
		else if(param.startsWith("u:"))
			infos.username = decodeComponent(param.substring(2));
		else if(param.startsWith("a:"))
			infos.avatar = decodeComponent(param.substring(2));
	}
	return infos;
}


export class Webhook {
	static BASE_URL = "https://discord.com/api/webhooks/";
	static url(idAndToken) {
		return Webhook.BASE_URL + idAndToken;
	}

	/**
	 * @overload
	 * @param {idAndToken} idAndToken The webhook's id and token
	 * @returns {Promise<{application_id:?string,avatar:?string,channel_id:string,guild_id:string,id:string,name:string,type:number,token:number,url:number}|{message:string,code:number}>} The webhook's data, or an error.
	 */
	/**
	 * @overload
	 * @param {idAndToken} idAndToken The webhook's id and token
	 * @param {true} checkOnly Whether to just check if the webhook exists
	 * @returns {Promise<boolean>} Whether the webhook exists or not
	 */
	/**
	 * Fetch a webhook's data
	 * @param {idAndToken} idAndToken The webhook's id and token
	 * @param {boolean} [checkOnly] Whether to just check if the webhook exists
	 */
	static async fetch(idAndToken, checkOnly = false) {
		const res = await fetch(Webhook.url(idAndToken), {method: checkOnly ? "HEAD" : "GET"})
		return checkOnly ? res.ok : res.json();
	}

	/**
	 * @param {WebhookInfo} webhookInfo The webhook info, in the format returned by webhookInfo
	 * @param {string} [threadId] The channel id. Only necessary if posting to a thread.
	 * @see webhookInfo
	 */
	constructor(webhookInfo, threadId) {
		Object.assign(this, parseWebhookInfo(webhookInfo));
		const threadParam = this.thread ? `?thread_id=${threadId}` : "";
		this.url = `${Webhook.BASE_URL}${this.idAndToken}${threadParam}`;
	}

	/**
	 * Post to this webhook. Like TextChannel#send, throws on failure. Moreover, on 401, 403 and 404 codes, the webhook will be purged and the `webhookPurged` property will be set to `true` on the Response object.
	 * @param {object} data The body of the POST request
	 * @param {boolean} wait 'wait' parameter, @see https://docs.discord.com/developers/resources/webhook#execute-webhook
	 * @returns The request
	 */
	async send(data, wait = false) {
		if(this.username || this.avatar)
			data = { ...data, username: this.username, avatar_url: this.avatar };
		
		const url =
			wait ? `${this.url}${this.thread ? "&" : "?"}wait=true`
			: this.url;
		const res = await fetch(url, {
			method:"POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify(data),
		});
		if(res.ok)
			return res;

		const { status } = res;
		if(status === 404 || status === 403 || status === 401)
		{
			purgeWebhook(this.idAndToken);
			res.webhookPurged = true;
		}
		throw res;
	}
}