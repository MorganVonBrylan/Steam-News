"use strict";

const Discord = require("discord.js");
const auth = exports.auth = require("./auth.json");

const client = exports.client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
	],
});


require("./localization");


var master;
exports.sendToMaster = (msg, onError = error) =>
	master?.send(msg).catch(onError)
	|| client.once("ready", async () => (await client.users.fetch(auth.master)).send(msg).catch(onError));

const error = require("./error");
const { init: initCmds } = require("./commands");

client.login(auth.token);

client.on("ready", async () => {
	exports.myself = client.user;
	exports.master = master = await client.users.fetch(auth.master);
	console.log(`Logged in as ${client.user.tag}!`);
});

client.once("ready", () => {
	initCmds(client, auth.debug);
	require("./dbl")(client, auth.dblToken, auth.dblWebhook);
});


for(const file of require("fs").readdirSync(__dirname+"/events"))
	client.on(file.substring(0, file.length - 3), require(`./events/${file}`));
