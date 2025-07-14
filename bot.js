
import importJSON from "./utils/importJSON.function.js";
export const auth = importJSON("auth.json");

import "./utils/prototypes.js";

if(auth.debug)
	auth.logLevel = "verbose";
else
	auth.logLevel ??= "log";

switch(auth.logLevel) {
	case "silent": console.error = Function.noop;
	case "error": console.warn = Function.noop;
	case "warn": console.log = Function.noop;
	case "log": console.info = Function.noop;
}

import {
	Client,
	GatewayIntentBits, Partials,
	ActivityType,
	ThreadChannel,
} from "discord.js";
import initCommands from "@brylan/djs-commands";
import { applyTranslations } from "./localization/index.js";
import { readdirSync } from "node:fs";

import { cacheLimits } from "./saveMyRAM.js";

export const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
	],
	partials: [
		Partials.Channel, // for DMs
		Partials.User, Partials.GuildMember, Partials.ThreadMember, // for performance
	],
	makeCache: cacheLimits,
	presence: { activities: [{
		type: ActivityType.Listening, name: "/watch",
	}]},
	shards: "auto",
});

if(!Object.hasOwn(ThreadChannel.prototype, "nsfw"))
{
	Object.defineProperty(ThreadChannel.prototype, "nsfw", {
		get: function() { return this.parent?.nsfw; },
	});
}


export var master;
export var myself;

import error from "./utils/error.js";
export async function sendToMaster(msg, onError = error)
{
	if(!client.readyAt)
		client.once("ready", () => client.users.fetch(auth.master)
		.then(master => master.send(msg))
		.catch(onError));
	else
	{
		if(!master)
			master = await client.users.fetch(auth.master);
		master.send(msg).catch(onError);
	}
}


client.login(auth.token);

client.on("ready", async () => {
	console.log(`Running as ${client.user.tag}!`);
	myself = client.user;
	const { members } = await client.guilds.fetch(auth.adminServer);
	master = (await members.fetch(auth.master)).user;
});

client.once("ready", () => {
	initCommands(client, {
		debug: auth.debug,
		ownerServer: auth.adminServer,
		makeEnumsGlobal: true,
		middleware: applyTranslations,
	}).then((cmds) => console.log(cmds.size, "commands loaded"))
	.catch(error);

	import("./steam_news/watchers.js").then(({scheduleChecks}) => scheduleChecks());

	if(auth.topGG)
		import("./topGG.js").then(({setup}) => setup(client, auth.topGG));

	const guildCountCheck = setInterval(() => {
		const nGuilds = client.guilds.cache.size;
		if(nGuilds > 12000)
		{
			master.send(`Yo I got about ${nGuilds}servers now, get to hybrid sharding\nhttps://www.npmjs.com/package/discord-hybrid-sharding`);
			clearInterval(guildCountCheck);
		}
	}, 3600_000);
});

import __dirname from "./utils/__dirname.js";
for(const file of readdirSync(__dirname(import.meta.url) + "/events"))
{
	// synchronous import causes a dependency loop
	import(`./events/${file}`)
	.then(({default: handler}) => client.on(file.slice(0, -3), handler));
}


client.on("shardReady", id => {
	console.log(`Shard ${id} online!`);
});
client.on("shardError", (err, id) => {
	err.shardId = id;
	error(err);
});
client.on("shardDisconnect", (_, id) => {
	console.warn(`Shard ${id} dead.`);
});