"use strict";

const {InteractionType: { ApplicationCommandAutocomplete: APPLICATION_COMMAND_AUTOCOMPLETE, ApplicationCommand: APPLICATION_COMMAND }} = require("discord.js");

const { commands } = require("../commands");

module.exports = exports = interaction => {
	const command = commands[interaction.commandName];

	if(interaction.type === APPLICATION_COMMAND_AUTOCOMPLETE)
	{
		return interaction.inGuild() || !command.dmPermission
		 	? command.autocomplete(interaction)
			: interaction.respond([{name: "This command only works in servers.", value: "N/A"}]).catch(Function());
	}

	if(interaction.type !== APPLICATION_COMMAND)
		return;

	if(!interaction.inGuild() && !command.global)
		return interaction.reply({ephemeral: true, content: "This command only works in servers."}).catch(error);

	if(command)
		command.run(interaction);
	else
		error(new Error(`Received unknown command: ${interaction.commandName}`));
};
