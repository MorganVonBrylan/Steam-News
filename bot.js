"use strict";

global.fetch ??= require("node-fetch");

const Discord = require("discord.js");
const auth = exports.auth = require("./auth.json");

const client = exports.client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
	],
	shards: "auto",
});


require("./localization");


var master;
exports.sendToMaster = (msg, onError = error) =>
	master?.send(msg).catch(onError)
	|| client.once("ready", async () => (await client.users.fetch(auth.master)).send(msg).catch(onError));

const error = require("./error");

client.login(auth.token);

client.on("ready", async () => {
	console.log(`Running as ${client.user.tag}!`);
	exports.myself = client.user;
	exports.master = master = await client.users.fetch(auth.master);
});

client.once("ready", () => {
	require("@brylan/djs-commands")(client, {
		debug: auth.debug,
		ownerServer: auth.adminServer,
		makeEnumsGlobal: true,
		middleware: require("./localization").applyTranslations,
	});
	require("./dbl")(client, auth.dblToken, auth.dblWebhook);
});


for(const file of require("fs").readdirSync(__dirname+"/events"))
	client.on(file.substring(0, file.length - 3), require(`./events/${file}`));


client.on("shardReady", id => {
	console.log(`Shard ${id} online!`);
});
client.on("shardError", (error, id) => {
	error.shardId = id;
	error(error);
});
client.on("shardResume", id => {
	console.log(`Shard ${id} is back, baby!`);
})
client.on("shardDisconnect", (_, id) => {
	console.warn(`Shard ${id} dead.`);
});
