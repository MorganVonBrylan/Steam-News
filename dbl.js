"use strict";

// vote test:
// fetch("http://localhost:5050/dblwebhook", {method: "post", headers: {Authorization: "giveme25morewatchersNOW"}, body: JSON.stringify({user: "263709367633838081",bot: "929757212841226292", type: "test", isWeekend: false})}).then(console.log)

const voteURLs = { default: "*oops, it seems I am actually not on Top.gg*" };
const topggLanguages = ["fr", "de", "hi", "tr"];

module.exports = exports = (client, token, webhook) => {
	process.on("uncaughtException", error); // Node process

	if(token)
	{
		const autoPoster = exports.autoPoster = new (require("topgg-autoposter").DJSPoster)(token, client);
		autoPoster.on("error", error);

		const {id} = client.user;
		voteURLs.default = `https://top.gg/bot/${id}/vote`;
		for(const lang of topggLanguages.concat(tr.locales))
			voteURLs[lang] = `https://top.gg/${topggLanguages.includes(lang) ? `${lang}/` : ""}bot/${id}/vote?lang=${lang}`;
	}

	const port = webhook?.port || process.env.SERVER_PORT;

	if(webhook)
	{
		const {exec} = require("node:child_process");
		// In case a previous listener was left dangling...
		exec(`lsof -i TCP:${port} | grep LISTEN`, (_, stdout) => {
			if(stdout)
				exec("kill -9 " + stdout.match(/[0-9]+/), launchWebhook);
			else
				launchWebhook();
		});
	}

	function launchWebhook()
	{
		exports.webhookServer?.close();

		const {addVoter} = require("./steam_news/VIPs");

		exports.webhook = new (require("@top-gg/sdk").Webhook)(webhook.password);
		const handleRequest = exports.webhook.middleware();

		const { createServer } = require("node:http");
		const server = exports.webhookServer = createServer(async (req, res) => {
			if(req.method !== "POST")
			{
				res.setHeader("Allow", "POST");
				res.statusCode = req.method === "OPTIONS" ? 200 : 405;
				return res.end();
			}

			res.sendStatus = code => { // to mimic express.js
				res.statusCode = code;
				res.end();
			}
			res.status = code => {
				res.statusCode = code;
				return { json: json => res.end(JSON.stringify(json)) };
			}
			await handleRequest(req, res, Function());

			const {vote} = req;
			if(vote)
				addVoter(vote.user, vote.query?.lang, vote.type === "test");
		});

		server.listen(port);
	}
}


exports.voteURL = locale => voteURLs[locale] || voteURLs.default;
