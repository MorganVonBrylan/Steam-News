
export class DblApi
{
	static BASE_URL = "https://discordbotlist.com/api/v1/bots/";
	
	/**
	 * @param {import("discord.js").Client} client Your bot's Discord.js client
	 * @param {string} token Your discordbotlist token
	 */
	constructor(client, token) {
		this.client = client;
		this.url = DblApi.BASE_URL + client.user.id;
		this.token = token;
	}

	_request(path, body) {
		return fetch(this.url + path, body ? {
			method: "POST",
			headers: {
				authorization: this.token,
				"content-type": "application/json",
			},
			body: typeof body === "string" ? body : JSON.stringify(body),
		} : {
			headers: { authorization: this.token },
		});
	}

	/**
	 * Returns the most recent 500 votes from the past 12 hours.
	 * @returns {Promise<{total:number, upvotes:{user_id:string, timestamp:string, username:string, discriminator:string, avatar:string}[]}>} 'timestamp' is an ISO 8601 timestamp. The avatar is a Discord avatar hash.
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
	 */
	async getVotes() {
		const res = await this._request("/upvotes");
		const data = await res.json();
		if(res.ok) return data;
		else throw new Error(data.message);
	}

	/**
	 * Post the bot's command list to DBL
	 * @param {object[]} commands Command data, same as you send to Discord
	 */
	async postCommands(commands) {
		const res = await this._request("/commands", commands);
		if(!res.ok)
			throw new Error((await res.json()).message);
	}

	/**
	 * Post the bot's stats
	 * @param {boolean} [recurrent] Default to true. Whether keep posting stats every hour.
	 */
	async postStats(recurrent = true) {
		const { application, guilds } = this.client;
		await application.fetch(); // otherwise approximateUserInstallCount is null
		const res = await this._request("/stats", {
			voice_connections: 0,
			users: application.approximateUserInstallCount || 0,
			guilds: guilds.cache.size || application.approximateGuildCount || 0,
		});
		if(!res.ok)
			throw new Error((await res.json()).message);
		
		if(recurrent)
		{
			clearInterval(this.postInterval);
			this.postInterval = setInterval(this.postStats.bind(this), 3600_000);
		}
	}
}

export default DblApi;