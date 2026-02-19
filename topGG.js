
import { addVoter } from "./steam_news/VIPs.js";
import { Api } from "@top-gg/sdk";
import { exec } from "node:child_process";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import getRawBody from "raw-body";

import { commands } from "@brylan/djs-commands";
const excludeCommands = ["owner", "unwatch", "steam-unwatch"];

const voteURLs = { default: "*oops, it seems I am actually not on Top.gg*" };
const topggLanguages = ["fr", "de", "hi", "tr"];

export const voteURL = locale => voteURLs[locale] || voteURLs.default;

export function setup(client, {token, webhook})
{
	process.on("uncaughtException", error);
	const clientReady = client.ws.status === 0;
	const api = new Api(token);

	if(token.startsWith("Bearer")) // v1 token
	{
		// timeout to make sure the commands were loaded
		if(clientReady)
			setTimeout(postCommands, 3000);
		else
			client.once("clientReady", () => setTimeout(postCommands, 3000));

		function postCommands() {
			const topggCommands = Object.values(commands)
				.filter(({name}) => !excludeCommands.includes(name));
				
			api._request("POST", "/v1/projects/@me/commands", topggCommands)
			.then(() => console.log("Top.GG command list updated"))
			.catch(error);
		}
	}

	function postStats() {
		return api.postStats({
			serverCount: client.guilds.cache.size,
			shardId: client.shard?.ids[0],
			shardCount: client.options.shardCount || 1,
		});
	}
	if(clientReady)
		postStats();
	else
		client.once("clientReady", postStats);
	setInterval(postStats, 3600_000);
	console.log("Top.gg stat posting enabled");

	const {id} = client.user;
	voteURLs.default = `https://top.gg/bot/${id}/vote`;
	for(const lang of topggLanguages.concat(tr.locales))
		voteURLs[lang] = `https://top.gg/${topggLanguages.includes(lang) ? `${lang}/` : ""}bot/${id}/vote?lang=${lang}`;


	if(webhook)
	{
		let webhookServer;
		const {
			port = process.env.SERVER_PORT,
			secret,
		} = webhook;

		// In case a previous listener was left dangling...
		exec(`lsof -i TCP:${port} | grep LISTEN`, (_, stdout) => {
			if(stdout)
				exec(`kill -9 ${stdout.match(/[0-9]+/)}`, launchWebhook);
			else
				launchWebhook();
		});

		function launchWebhook()
		{
			webhookServer?.close();
			webhookServer = createServer(async (req, res) => {
				if(req.method !== "POST")
				{
					res.setHeader("Allow", "POST");
					res.statusCode = req.method === "OPTIONS" ? 200 : 405;
					return res.end();
				}

				const rawBody = await getRawBody(req, { encoding: "utf-8" });
				const err = await verifySignature(req.headers, rawBody, secret);
				if(err)
				{
					error(`Received a bogus vote: ${err.error}`);
					res.statusCode = err.code;
					res.end(err.error);
					return;
				}
				
				const { type, data: { user: { platform_id: id } } } = JSON.parse(rawBody);
				// getting the language isn't possible anymore it seems
				addVoter(id, null, type === "test");
			});

			webhookServer.listen(port);
			console.log("Top.gg webhook listening on port", port);
		}
	}
}



// from https://github.com/top-gg/webhooks-v2-nodejs-example/blob/main/index.js
/**
 * Verify the signature of an incoming vote request.
 * @param {{[header: string]: string}} headers The request headers.
 * @param {string} rawBody The request body
 * @param {string} secret The webhook secret, in the form whs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * @returns {Promise<?{code: 400|401|403, error: string}>} What made the signature fail, or null if the signature was valid.
 * @example import { createServer } from "node:http";
  import getRawBody from "raw-body";
  createServer(async (req, res) => {
	const body = await getRawBody(req, { encoding: "utf-8" });
	const err = await verifySignature(req.headers, body, "whs_abc123");
	if(err) {
	 	res.statusCode = err.code;
		res.end(err.error);
	} else {
		res.end();
		// apply reward for the vote
	}
  }).listen(5050);
 */
async function verifySignature(headers, rawBody, secret)
{
	const signatureHeader = headers["x-topgg-signature"];
	if(!signatureHeader)
		return { code: 401, error: "Missing signature" };

	// Signature format: t={unix timestamp},v1={signature}
	const parsedSignature = signatureHeader.split(",").map(part => part.split("="));
	const {
		t: timestamp,
		v1: signature,
	} = Object.fromEntries(parsedSignature);

	if(!timestamp || !signature)
		return { code: 400, error: "Invalid signature format" };

	const hmac = createHmac("sha256", secret);
	const digest = hmac.update(`${timestamp}.${rawBody}`).digest("hex");
	/* If this fails, there's a few things that could've happened:
	 * 1. The webhook secret is incorrect
	 * 2. The payload was tampered with
	 * 3. The request did not originate from Top.gg
	 * In any of these cases, we want to reject the request. */
	if(signature !== digest)
		return { code: 403, error: "Invalid signature" };

	return null;
};