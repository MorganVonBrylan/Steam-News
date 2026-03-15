
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

/** Standardised string representing webhook data, as stored in the database.
 * 
 * Conforms to the regex /^[0-9]+\/\w+(#t)?(#u:[^#]+)?(#a:[^#:]+)?$/
 * 
 * Which is (webhook id)/(webhook token)(#thread)(#u:username)(#a:avatar url) with each of the last 3 parts optional.
 * @typedef {`${number}/${string}${"#t"|""}${`#u:${string}`|""}${`#a:${string}`|""}`} WebhookInfo
 * */
export const webhookInfoRegex = /^[0-9]+\/\w+(#t)?(#u:[^#]+)?(#a:[^#:]+)?$/;


/**
 * Get a standardised string containing all the info for a watcher's webhook.
 * The returned format is as follows: id/token(?thread_id=id)?#u:username#a:avatarURL
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

	let webhookInfo = match[1];
	const { channel_id } = await res.json();
	if(channel_id !== channel.id)
	{
		if(channel_id === channel.parentId)
			webhookInfo += "#t";
		else
			throw new RangeError("wrong-channel");
	}
	if(username)
		webhookInfo += `#u:${encodeComponent(username)}`;
	if(avatar)
	{
		const res = await fetch(avatar, { method: "HEAD" }).catch(() => Object.null);
		if(res.ok)
			webhookInfo += `#a:${encodeComponent(avatar)}`;
	}

	return webhookInfo;
}


export class Webhook {
	static BASE_URL = "https://discord.com/api/webhooks/";
	static url(idAndToken) {
		return Webhook.BASE_URL + idAndToken;
	}

	/**
	 * @param {WebhookInfo} webhookInfo The webhook info, in the format returned by webhookInfo
	 * @param {string} [threadId] The channel id. Only necessary if posting to a thread.
	 * @see webhookInfo
	 */
	constructor(webhookInfo, threadId) {
		const [path, ...infos] = webhookInfo.split("#");
		[this.idAndToken, this.threadId] = path.split("?thread_id=");
		this.url = Webhook.BASE_URL + path;
		for(const info of infos)
		{
			if(info === "t")
				this.url += `?thread_id=${threadId}`;
			else if(info.startsWith("u:"))
				this.username = decodeComponent(info.substring(2));
			else if(info.startsWith("a:"))
				this.avatar = decodeComponent(info.substring(2));
		}
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
			wait ? `${this.url}${this.threadId ? "&" : "?"}wait=true`
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