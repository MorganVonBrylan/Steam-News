"use strict";

global.fetch ??= require("node-fetch");

const Discord = require("discord.js");
const auth = exports.auth = require("./auth.json");

const client = exports.client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
	],
	partials: [Discord.Partials.Channel], // for DMs
	shards: "auto",
});


require("./localization");


if(!Object.hasOwn(Discord.ThreadChannel.prototype, "nsfw"))
{
	Object.defineProperty(Discord.ThreadChannel.prototype, "nsfw", {
		get: function() { return this.parent?.nsfw; },
	});
}


var master;
exports.sendToMaster = (msg, onError = error) =>
	master?.send(msg).catch(onError)
	|| client.once("ready", async () => (await client.users.fetch(auth.master)).send(msg).catch(onError));

const error = require("./error");

client.login(auth.token);

client.on("ready", async () => {
	console.log(`Running as ${client.user.tag}!`);
	exports.myself = client.user;
	const { members } = await client.guilds.fetch(auth.adminServer);
	exports.master = master = (await members.fetch(auth.master)).user;
});

client.once("ready", () => {
	require("@brylan/djs-commands")(client, {
		debug: auth.debug,
		ownerServer: auth.adminServer,
		makeEnumsGlobal: true,
		middleware: require("./localization").applyTranslations,
	});
	require("./dbl")(client, auth.dblToken, auth.dblWebhook);

	const guildCountCheck = setInterval(() => {
		const nGuilds = client.guilds.cache.size;
		if(nGuilds > 12000)
		{
			master.send(`Yo I got about ${nGuilds}servers now, get to hybrid sharding\nhttps://www.npmjs.com/package/discord-hybrid-sharding`);
			clearInterval(guildCountCheck);
		}
	}, 3600_000);
});


for(const file of require("node:fs").readdirSync(__dirname+"/events"))
	client.on(file.substring(0, file.length - 3), require(`./events/${file}`));


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
