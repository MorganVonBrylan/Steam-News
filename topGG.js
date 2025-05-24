// vote test:
// fetch("http://localhost:5050/dblwebhook", {method: "post", headers: {Authorization: "giveme25morewatchersNOW"}, body: JSON.stringify({user: "263709367633838081",bot: "929757212841226292", type: "test", isWeekend: false})}).then(console.log)

import { addVoter } from "./steam_news/VIPs.js";
import { DJSPoster } from "topgg-autoposter";
import { Webhook } from "@top-gg/sdk";
import { exec } from "node:child_process";
import { createServer } from "node:http";

const voteURLs = { default: "*oops, it seems I am actually not on Top.gg*" };
const topggLanguages = ["fr", "de", "hi", "tr"];

export const voteURL = locale => voteURLs[locale] || voteURLs.default;

export function setup(client, {token, webhook})
{
	process.on("uncaughtException", error);
	let webhookServer;

	const autoPoster = new DJSPoster(token, client);
	autoPoster.on("error", error);

	const {id} = client.user;
	voteURLs.default = `https://top.gg/bot/${id}/vote`;
	for(const lang of topggLanguages.concat(tr.locales))
		voteURLs[lang] = `https://top.gg/${topggLanguages.includes(lang) ? `${lang}/` : ""}bot/${id}/vote?lang=${lang}`;

	const port = webhook?.port || process.env.SERVER_PORT;

	if(webhook)
	{
		// In case a previous listener was left dangling...
		exec(`lsof -i TCP:${port} | grep LISTEN`, (_, stdout) => {
			if(stdout)
				exec(`kill -9 ${stdout.match(/[0-9]+/)}`, launchWebhook);
			else
				launchWebhook();
		});
	}

	function launchWebhook()
	{
		webhookServer?.close();
		const topggWebhook = new Webhook(webhook.password);
		const handleRequest = topggWebhook.listener(vote => {
			if(vote)
				addVoter(vote.user, vote.query?.lang, vote.type === "test");
		})

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
	}
}
