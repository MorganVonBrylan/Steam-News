"use strict";

/** Information expected from each command file:
 * description
 * run
 ** Optional:
 * defaultPermission
 * permissions
 */

const { readdirSync } = require("fs");


class LoadError extends Error {
	constructor(commandName, message) {
		super(message);
		this.commandName = commandName;
	}
}

exports.LoadError = LoadError;
const commands = exports.commands = {};
exports.load = exports.reload = load;

var skipDebug = true;

function load(name, cmdModule = "", reload = false)
{
	if(typeof name !== "string")
		throw new TypeError("'name' should be a string");

	if(name.endsWith(".js"))
		name = name.substring(0, name.length - 3);

	if(name.length > 32)
		throw new LoadError(name, `Command name too long (${name.length})/32`);
	if(!/^[a-z_-]{1,32}$/.test(name))
		throw new LoadError(name, `Invalid command name: ${name}`);

	if(commands[name] && commands[name].module !== cmdModule)
		throw new LoadError(name, `Can't load command ${name} of module "${cmdModule}", it already exists in module "${commands[name].module}"`);

	const file = `./${cmdModule}${cmdModule ? "/" : ""}${name}.js`;
	//delete require.cache[file];
	const command = require(file);
	command.name = name;
	command.module = cmdModule;
	const {description, run, permissions = [], type = "CHAT_INPUT"} = command;

	if(typeof run !== "function")
		throw new LoadError(name, "Missing a 'run' function.");
	if(!Array.isArray(permissions))
		throw new LoadError(name, "'permissions' should be an array.");

	if(type === "CHAT_INPUT")
	{
		if(!description)
			throw new LoadError(name, `Missing description.`);
		if(typeof description !== "string")
			throw new LoadError(name, "The description should be a string.");
		if(description.length < 4)
			throw new LoadError(name, `Description too short.`);
		if(description.length > 100)
			throw new LoadError(name, `Description too long (${description.length}/100).`);

		if(!command.options)
			command.options = []; // So we can remove options
		else for(const option of command.options)
			if(option.autocomplete)
			{
				if(!("autocomplete" in command))
					throw new LoadError(name, `Command has an autocomplete option, but no autocomplete handler.`);
				if(typeof command.autocomplete !== "function")
					throw new LoadError(name, `Autocomplete handler should be a function.`);
				break;
			}
	}
	else
	{
		if("description" in command)
			throw new LoadError(name, "Non-chat input commands cannot have a description.");
		if("options" in command)
			throw new LoadError(name, "Non-chat input commands cannot have options.");
	}

	commands[name] = command;
}


function loadFolder(path, commandManager)
{
	const cmdModule = path.substring(__dirname.length + 1);

	for(const file of readdirSync(path))
	{
		if(file === "index.js" || file === "admin" || file === "debug" && skipDebug)
			continue;

		if(file.endsWith(".js"))
			load(file, cmdModule);
		else
			loadFolder(`${path}/${file}`);
	}

	if(commandManager)
		return commandManager.set(Object.values(commands));
}

exports.init = (client, debug) => {
	skipDebug = !debug;
	const commandManager = (debug ? client.guilds.cache.first() : client.application).commands;
	const load = loadFolder(__dirname, commandManager);

	const { adminServer, master } = require("../auth.json");
	if(adminServer) client.guilds.fetch(adminServer).then(async adminServer => {
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
			{ id, permissions: [{ id: master, type: "USER", permission: true }] },
		]});

		if(commandManager === adminServer.commands)
			load.then(() => commandManager.create(adminCmd)).then(then);
		else
			adminServer.commands.set([adminCmd]).then(([[,cmd]]) => then(cmd), error);
	}, err => console.error("Could not fetch admin server", err));
}
