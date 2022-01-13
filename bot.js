"use strict";

const Discord = require("discord.js");
const INTENTS = Discord.Intents.FLAGS;
const auth = exports.auth = require("./auth.json");

const client = exports.client = new Discord.Client({
	intents: new Discord.Intents([
		INTENTS.GUILDS,
	]),
});

const {FLAGS: { ADMINISTRATOR }} = Discord.Permissions;

var master;
exports.sendToMaster = (msg, onError = error) => master.send(msg).catch(onError);

const error = require("./error");
const { commands, init: initCmds } = require("./commands");

client.login(auth.token);

client.on("ready", async () => {
	exports.myself = client.user;
	exports.master = master = await client.users.fetch(auth.master);
	console.log(`Connecté en tant que ${client.user.tag} !`);
	initCmds(master, auth.debug);
});


for(const file of require("fs").readdirSync(__dirname+"/events"))
	client.on(file.substring(0, file.length - 3), require(`./events/${file}`));


client.on("interactionCreate", interaction => {
	if(interaction.type !== "APPLICATION_COMMAND")
		return;

	const command = commands[interaction.commandName];

	if(command)
	{
		if(command.adminOnly && !interaction.member.permissions.has(ADMINISTRATOR))
			interaction.reply({content: "Seuls les admins peuvent utiliser cette commande.", ephemeral: true}).catch(error);
		else
			command.run(interaction);
	}
	else
		error(`Commande inconnue reçue : ${interaction.commandName}`);
});
