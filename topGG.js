
import { addVoter } from "./steam_news/VIPs.js";
import { Api, Webhook } from "@top-gg/sdk";
import { exec } from "node:child_process";
import { createServer } from "node:http";

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
				
			api._request("POST", "/v1/projects/@me/commands", JSON.stringify(topggCommands))
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
		const port = webhook?.port || process.env.SERVER_PORT;

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
			const topggWebhook = new Webhook(webhook.password);
			const handleRequest = topggWebhook.listener(vote => {
				if(vote)
					addVoter(vote.user, vote.query?.lang, vote.type === "test");
			});

			webhookServer = createServer(async (req, res) => {
				if(req.method !== "POST")
				{
					res.setHeader("Allow", "POST");
					res.statusCode = req.method === "OPTIONS" ? 200 : 405;
					return res.end();
				}

				// to mimic express.js
				Object.assign(res, {
					sendStatus: code => {
						res.statusCode = code;
						res.end();
					},
					status: code => {
						res.statusCode = code;
						return { json: json => res.end(JSON.stringify(json)) };
					},
				});
				
				await handleRequest(req, res, Function.noop);
			});

			webhookServer.listen(port);
			console.log("Top.gg webhook listening on port", port);
		}
	}
}
