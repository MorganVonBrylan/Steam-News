"use strict";

const {InteractionType: { ApplicationCommandAutocomplete: APPLICATION_COMMAND_AUTOCOMPLETE, ApplicationCommand: APPLICATION_COMMAND }} = require("discord.js");

const { commands } = require("../commands");

module.exports = exports = interaction => {
	const command = commands[interaction.commandName];

	if(interaction.type === APPLICATION_COMMAND_AUTOCOMPLETE)
		return command.autocomplete(interaction);

	if(interaction.type !== APPLICATION_COMMAND)
		return;

	if(command)
		command.run(interaction);
	else
		error(new Error(`Received unknown command: ${interaction.commandName}`));
};
