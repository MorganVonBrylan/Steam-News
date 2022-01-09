"use strict";

const Discord = require("discord.js");
const INTENTS = Discord.Intents.FLAGS;
const auth = exports.auth = require("./auth.json");

const client = exports.client = new Discord.Client({
	intents: new Discord.Intents([
		INTENTS.GUILDS,
	]),
});

var master;
exports.sendToMaster = (msg, onError = error) => master.send(msg).catch(onError);

const error = require("./error");
//const { commands } = require("./commands");

client.login(auth.token);

client.on("ready", async () => {
	exports.myself = client.user;
	exports.master = master = await client.users.fetch(auth.master);
	console.log(`Connecté en tant que ${client.user.tag} !`);
});


/*
client.on("interactionCreate", interaction => {
	if(interaction.isMessageComponent())
		return componentInteraction(interaction);
	else if(!interaction.isCommand())
		return;

	const command = commands[interaction.commandName];

	if(command)
		command.run(interaction);
	else
		error(`Commande inconnue reçue : ${interaction.commandName}`);
});
*/
