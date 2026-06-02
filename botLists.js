
import importJSON from "./utils/importJSON.function.js";
export const { topGG, dbl, webhookPort = +process.env.SERVER_PORT } = importJSON("auth.json");

import { Api } from "@top-gg/sdk";
import DblApi from "./dblApi.js";
import { exec } from "node:child_process";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import getRawBody from "raw-body";

import { commands } from "@brylan/djs-commands";
const excludeCommands = ["owner", "unwatch", "steam-unwatch"];

const voteURLs = { default: "*oops, it seems I am actually not on Top.gg*" };
const topggLanguages = ["fr", "de", "hi", "tr"];
const BAD_REQUEST = 400, WRONG_METHOD = 405, UNSUPPORTED_TYPE = 415,
	UNAUTHORIZED = 401, FORBIDDEN = 403,
	NOT_FOUND = 404, OK = 200;

import { clientLoggedIn, client } from "./bot.js";
import { addDBLVoter } from "./steam_news/VIPs.js";
const topggApi = topGG?.token ? new Api(topGG.token) : null;
const dblApi = dbl?.token ? new DblApi(await clientLoggedIn, dbl.token) : null;

export const voteURL = locale => voteURLs[locale] || voteURLs.default;

export async function postCommands()
{
	const dblCommands = Object.values(commands)
		.filter(({name}) => !excludeCommands.includes(name));
	
	dblApi?.postCommands(dblCommands)
		.then(() => console.log("DiscordBotList command list updated"))
		.catch(error);
	
	topggApi?._request("POST", "/v1/projects/@me/commands", dblCommands)
		.then(() => console.log("Top.GG command list updated"))
		.catch(error);
}

export async function setup()
{
	process.on("uncaughtException", error);
	
	if(dblApi)
	{
		dblApi.postStats()
			.then(() => console.log("DBL stat posting enabled"))
			.catch(error);
	}

	if(topggApi)
	{
		function postStats() {
			return topggApi.postStats({
				serverCount: client.guilds.cache.size,
				shardId: client.shard?.ids[0],
				shardCount: client.options.shardCount || 1,
			});
		}
		postStats();
		setInterval(postStats, 3600_000);
		console.log("Top.gg stat posting enabled");

		const {id} = client.user;
		voteURLs.default = `https://top.gg/bot/${id}/vote`;
		for(const lang of topggLanguages.concat(tr.locales))
			voteURLs[lang] = `https://top.gg/${topggLanguages.includes(lang) ? `${lang}/` : ""}bot/${id}/vote?lang=${lang}`;
	}


	if(topGG?.webhook?.port)
		console.error("topGG.webhook.port is no longer supported. Use webhookPort instead.");
	const webhooks = {
		topGG: topGG?.webhook,
		dbl: dbl?.webhook,
	};
	if(webhooks.topGG || webhooks.dbl)
	{
		if(!Number.isInteger(webhookPort) || webhookPort < 1000)
			throw new TypeError(`Invalid port for the webhooks: ${webhookPort}`);

		let webhookServer;
		/** @type {{[endpoint:string]: Parameters<createServer>[1]}} */
		const endpoints = Object.create(null);
		if(webhooks.topGG)
		{
			// https://docs.top.gg/webhooks/overview
			const { endpoint = "/topggVote", secret } = webhooks.topGG;
			if(!secret)
				throw new Error("Missing Top.gg webhook secret");

			const { addVoter } = await import("./steam_news/VIPs.js");
			endpoints[endpoint] = async (req, res) => {
				const rawBody = await getRawBody(req, { encoding: "utf-8" });
				const err = await verifySignature(req.headers, rawBody, secret);
				if(err)
				{
					error(`Received a bogus Top.gg vote: ${err.error}`);
					res.statusCode = err.code;
					res.end(err.error);
					return;
				}
				res.end();
				const { type, data: { user: { platform_id: id } }, query } = JSON.parse(rawBody);
				addVoter(id, query?.lang, type === "webhook.test");
			};
		}
		if(webhooks.dbl)
		{
			// https://docs.discordbotlist.com/vote-webhooks
			const { endpoint = "/dblVote", secret } = webhooks.dbl;
			if(!secret)
				throw new Error("Missing DBL webhook secret");
			endpoints[endpoint] = async (req, res) => {
				const { authorization } = req.headers;
				if(!authorization)
					res.statusCode = UNAUTHORIZED;
				else if(authorization !== secret)
				{
					error(`Received a bogus DBL vote: ${authorization}`);
					res.statusCode = FORBIDDEN;
				}
				else
				{
					const body = await getRawBody(req, { encoding: "utf-8" });
					try {
						const { id } = JSON.parse(body);
						addDBLVoter(id);
					} catch {
						error(`Invalid DBL body received: \`\`\`${body || "\n"}\`\`\``);
						res.statusCode = UNSUPPORTED_TYPE;
						res.setHeader("Accept-Post", "application/json; charset=UTF-8");
					}
				}
			};
		}
		Object.freeze(endpoints);

		// In case a previous listener was left dangling...
		exec(`lsof -i TCP:${webhookPort} | grep LISTEN`, (_, stdout) => {
			if(stdout)
				exec(`kill -9 ${stdout.match(/[0-9]+/)}`, launchWebhook);
			else
				launchWebhook();
		});

		function launchWebhook()
		{
			webhookServer?.close();
			webhookServer = createServer(async (req, res) => {
				const endpoint = endpoints[req.url];
				if(!endpoint)
					res.statusCode = NOT_FOUND;
				else if(req.method !== "POST")
				{
					res.statusCode = req.method === "OPTIONS" ? OK : WRONG_METHOD;
					res.setHeader("Allow", "POST");
				}
				else
					await endpoint(req, res);

				if(!res.writableEnded)
					res.end();
			});

			webhookServer.listen(webhookPort);
			console.log(
				webhooks.topGG ? (webhooks.dbl ? "Webhooks" : "Top.gg webhook") : "DBL webhook",
				"listening on port", webhookPort);
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
		return { code: UNAUTHORIZED, error: "Missing signature" };

	// Signature format: t={unix timestamp},v1={signature}
	const parsedSignature = signatureHeader.split(",").map(part => part.split("="));
	const {
		t: timestamp,
		v1: signature,
	} = Object.fromEntries(parsedSignature);

	if(!timestamp || !signature)
		return { code: BAD_REQUEST, error: "Invalid signature format" };

	const hmac = createHmac("sha256", secret);
	const digest = hmac.update(`${timestamp}.${rawBody}`).digest("hex");
	/* If this fails, there's a few things that could've happened:
	 * 1. The webhook secret is incorrect
	 * 2. The payload was tampered with
	 * 3. The request did not originate from Top.gg
	 * In any of these cases, we want to reject the request. */
	if(signature !== digest)
		return { code: FORBIDDEN, error: "Invalid signature" };

	return null;
};