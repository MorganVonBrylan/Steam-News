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
exports.sendToMaster = (msg, onError = error) =>
	master?.send(msg).catch(onError)
	|| client.once("ready", async () => (await client.users.fetch(auth.master)).send(msg).catch(onError));

const error = require("./error");
const { commands, init: initCmds } = require("./commands");

client.login(auth.token);

client.on("ready", async () => {
	exports.myself = client.user;
	exports.master = master = await client.users.fetch(auth.master);
	console.log(`Logged in as ${client.user.tag}!`);
});

client.once("ready", () => {
	initCmds(client, auth.debug);
	require("./dbl")(auth.dblToken, client);
});


for(const file of require("fs").readdirSync(__dirname+"/events"))
	client.on(file.substring(0, file.length - 3), require(`./events/${file}`));


client.on("interactionCreate", interaction => {
	const command = commands[interaction.commandName];

	if(interaction.type === "APPLICATION_COMMAND_AUTOCOMPLETE")
	{
		return interaction.inGuild() || command.global
		 	? command.autocomplete(interaction)
			: interaction.respond([{name: "This command only works in servers.", value: "N/A"}]).catch(Function());
	}

	if(interaction.type !== "APPLICATION_COMMAND")
		return;

	if(!interaction.inGuild() && !command.global)
		return interaction.reply({ephemeral: true, content: "This command only works in servers."}).catch(error);

	if(command)
		command.run(interaction);
	else
		error(new Error(`Received unknown command: ${interaction.commandName}`));
});
