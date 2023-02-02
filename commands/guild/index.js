"use strict";

// Guild commands, for those that need different options depending on the server

const { checkCommand, LoadError } = require("..");

const guildCommands = exports.commands = {};
const defaultShouldCreateFor = () => true;

exports.createCmd = createCmd;
exports.updateCmd = updateCmd;

for(const file of require("fs").readdirSync(__dirname))
{
	if(file === "index.js" || file[0] === "_")
		continue;

	const cmd = require(`./${file}`);
	cmd.name = file.slice(0, -3);
	cmd.apiCommands = new Map();

	if(!cmd.shouldCreateFor)
		cmd.shouldCreateFor = defaultShouldCreateFor;
	else if(typeof cmd.shouldCreateFor !== "function")
		throw new LoadError(cmd.name, `Guild command 'shouldCreateFor' must be a function.`);

	checkCommand(cmd);
	guildCommands[cmd.name] = cmd;
}


exports.init = client => {
	const guilds = client.guilds.cache;
	for(const command of Object.values(guildCommands))
	{
		for(const {id, commands} of guilds.values())
		{
			const apiCmd = commands.cache.find(({name}) => name === command.name);
			if(apiCmd)
				command.apiCommands.set(id, apiCmd);
			else
				createCmd(command, {id, commands});
		}
	}


	client.on("guildCreate", ({id, commands}) => {
		commands.set(Object.values(guildCommands)
			.filter(cmd => cmd.shouldCreateFor(id))
			.map(cmd => ({ ...cmd, options: cmd.getOptions(id) }))
		).then(apiCommands => {
			for(const apiCmd of apiCommands)
				guildCommands[apiCmd.name].apiCommands.set(id, apiCmd);
		}, error);
	});

	client.on("guildDelete", ({id}) => {
		for(const {apiCommands} of Object.values(guildCommands))
			apiCommands.delete(id);
	});
};


function createCmd(command, {id, commands})
{
	return command.shouldCreateFor(id)
		&& commands.create({ ...command, options: command.getOptions(id) })
			.then(apiCmd => command.apiCommands.set(id, apiCmd), error)
}

function updateCmd(command, {id, commands}, createIfNotExists = false)
{
	let apiCmd = command.apiCommands.get(id);
	if(!apiCmd)
	{
		apiCmd = commands.cache.find(({name}) => name === command.name);
		command.apiCommands.set(id, apiCmd);
	}

	if(!command.shouldCreateFor(id) && apiCmd)
	{
		command.apiCommands.delete(id);
		return apiCmd.delete().catch(error);
	}
	else
	{
		const cmdData = { ...command, options: command.getOptions(id) };
		if(apiCmd)
			return apiCmd.edit(cmdData).catch(error);
		else if(createIfNotExists)
			return commands.create(cmdData).then(apiCmd => command.apiCommands.set(id, apiCmd), error);
		else
			error(new Error(`Tried to update command ${command.name} for guild ${guild}, but the API command couldn't be found.`));
	}
}
