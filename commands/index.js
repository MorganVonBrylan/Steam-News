"use strict";

/** Information expected from each command file:
 * description
 * run
 ** Optional:
 * global
 * options
 * autocomplete
 * defaultPermission
 */

const { readdirSync } = require("fs");
const NAME_REGEX = /^[a-z_-]{1,32}$/;
var skipDebug = true;


class LoadError extends Error {
	constructor(commandName, message) {
		super(message);
		this.commandName = commandName;
	}
}

exports.LoadError = LoadError;
const commands = exports.commands = {};
exports.load = exports.reload = load;
exports.checkCommand = checkCommand;


exports.init = (client, debug) => {
	skipDebug = !debug;
	const commandManager = (debug ? client.guilds.cache.first() : client.application).commands;
	const load = loadFolder(__dirname, commandManager);
	load.then(() => {
		const { init, commands: guildCommands } = require("./guild");
		init(client);
		Object.assign(commands, guildCommands);
	});

	const { adminServer } = require("../auth.json");
	if(adminServer)
		client.guilds.fetch(adminServer).then(initAdminCmds.bind(load), err => console.error("Could not fetch admin server", err));
}


function checkCommand(command)
{
	const {name} = command;
	if(name.length > 32)
		throw new LoadError(name, `Command name too long (${name.length})/32`);
	if(!NAME_REGEX.test(name))
		throw new LoadError(name, `Invalid command name: ${name}`);

	const {description, run, type = "CHAT_INPUT"} = command;

	if(typeof run !== "function")
		throw new LoadError(name, "Missing a 'run' function.");

	if(type === "CHAT_INPUT")
	{
		if(!description)
			throw new LoadError(name, `Missing description.`);
		if(typeof description !== "string")
			throw new LoadError(name, "The description must be a string.");
		if(description.length < 4)
			throw new LoadError(name, `Description too short.`);
		if(description.length > 100)
			throw new LoadError(name, `Description too long (${description.length}/100).`);

		if(!command.options)
			command.options = []; // So we can remove options
		else if(!Array.isArray(command.options))
			throw new LoadError(name, "'options' must be an Array.");
		else for(const option of command.options)
		{
			if(!NAME_REGEX.test(option.name))
				throw new LoadError(name, `Invalid option name: ${option.name}`);

			if(option.autocomplete)
			{
				if(!("autocomplete" in command))
					throw new LoadError(name, `Command has an autocomplete option, but no autocomplete handler.`);
				if(typeof command.autocomplete !== "function")
					throw new LoadError(name, `Autocomplete handler must be a function.`);
				break;
			}
		}
	}
	else
	{
		if("description" in command)
			throw new LoadError(name, "Non-chat input commands cannot have a description.");
		if("options" in command)
			throw new LoadError(name, "Non-chat input commands cannot have options.");
	}
}

function load(name, subfolder = "", reload = false)
{
	if(typeof name !== "string")
		throw new TypeError("'name' must be a string");

	if(name.endsWith(".js"))
		name = name.slice(0, -3);

	if(commands[name] && commands[name].module !== subfolder)
		throw new LoadError(name, `Can't load command ${name} of subfolder "${subfolder}", it already exists in module "${commands[name].module}"`);

	const file = `./${subfolder}${subfolder ? "/" : ""}${name}.js`;
	//delete require.cache[file];
	const command = require(file);
	command.name = name;
	command.module = subfolder;

	checkCommand(command);
	commands[name] = command;
}


function loadFolder(path, commandManager)
{
	const subfolder = path.substring(__dirname.length + 1);

	for(const file of readdirSync(path))
	{
		if(file === "index.js" || file === "guild" || file === "admin" || file === "debug" && skipDebug)
			continue;

		if(file.endsWith(".js"))
			load(file, subfolder);
		else
			loadFolder(`${path}/${file}`);
	}

	if(commandManager)
		return commandManager.set(Object.values(commands));
}


function initAdminCmds(adminServer)
{
	const adminCmds = {};

	for(const cmd of require("fs").readdirSync(__dirname+"/admin").map(f => f.substring(0, f.length-3)))
		adminCmds[cmd] = require("./admin/"+cmd);

	const adminCmd = commands.admin = {
		name: "admin",
		defaultPermission: false,
		description: "Execute an admin command",
		options: [{
			type: "STRING", name: "command", required: true,
			description: "The command to execute",
			choices: Object.keys(adminCmds).map(cmd => ({name: cmd, value: cmd})),
		}, {
			type: "STRING", name: "params",
			description: "The command parameters",
		}],
		run: inter => adminCmds[inter.options.getString("command")].run(inter, inter.options.getString("params"))
	};

	const then = ({id}) => adminServer.commands.permissions.set({fullPermissions:[
		{ id, permissions: [{ id: require("../auth.json").master, type: "USER", permission: true }] },
	]});

	if(skipDebug)
		adminServer.commands.set([adminCmd]).then(([[,cmd]]) => then(cmd)).catch(error);
	else
		this.then(() => adminServer.commands.create(adminCmd)).then(then).catch(error);
}
