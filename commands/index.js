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
var commandManager;
exports.load = exports.reload = load;

// Can't have perms on application commands
//const masterPerm = { id: require("../auth.json").master, type: "USER", permission: true };

const existingCmds = {}; // form: "cmdName": "module"
var skipDebug = true;

function load(name, cmdModule = "", reload = false)
{
	if(typeof name !== "string")
		throw new TypeError("'name' should be a string");

	if(name.endsWith(".js"))
		name = name.substring(0, name.length - 3);

	if(name.length > 32)
		throw new LoadError(name, `Nom de commande trop long (${name.length})`);
	if(!/^[\w-]{1,32}$/.test(name))
		throw new LoadError(name, `Nom de commande invalide : ${name}`);

	if(commands[name] && commands[name].module !== cmdModule)
		throw new LoadError(name, `Impossible d'enregistrer la commande ${name} du module "${cmdModule}", elle existe déjà dans le module "${commands[name].module}"`);

	const file = `./${cmdModule}${cmdModule ? "/" : ""}${name}.js`;
	delete require.cache[file];
	const command = require(file);
	command.name = name;
	command.module = cmdModule;
	if(!command.options) command.options = []; // Pour pouvoir retirer les options
	const {description, run, permissions = [], type = "CHAT_INPUT"} = command;

	if(typeof run !== "function")
		throw new LoadError(name, "Missing a 'run' function.");
	if(!Array.isArray(permissions))
		throw new LoadError(name, "'permissions' should be an array.");

	if(type === "CHAT_INPUT")
	{
		if(!command.options)
			command.options = []; // Pour pouvoir retirer les options

		if(typeof description !== "string")
			throw new LoadError(name, "The description should be a string.");
		if(!description)
			throw new LoadError(name, `Nom de commande invalide : ${name}`);
		if(description.length < 4)
			throw `Description de ${name} trop courte`;
		if(description.length > 100)
			throw `Description de ${name} trop longue (${description.length})`;
	}
	else
	{
		if("description" in command)
			throw new LoadError(name, "Non-chat input commands cannot have a description.");
		if("options" in command)
			throw new LoadError(name, "Non-chat input commands cannot have options.");
	}

	commands[name] = command;

	const cmd = commandManager.cache.find(cmd => cmd.name === name);
	const promise = cmd
		? (cmd.equals(command, true) ? Promise.resolve({}) : cmd.edit(command))
		: commandManager.create(command);

	/*if(!command.defaultPermission)
	{
		permissions.push(masterPerm);
		promise.then(cmd => cmd.permissions.set({permissions}).catch(error));
	}*/

	promise.catch(error);
	promise.cmdName = name;
	return promise;
}


function loadFolder(path)
{
	const cmdModule = path.substring(__dirname.length + 1);
	const promises = [];

	for(const file of readdirSync(path))
	{
		if(file === "index.js" || file === "debug" && skipDebug)
			continue;

		if(file.endsWith(".js"))
			promises.push(load(file, cmdModule));
		else
			promises.push(...loadFolder(`${path}/${file}`));
	}

	if(cmdModule)
		return promises;
	else
	{
		const loadedCommands = promises.map(({cmdName}) => cmdName);
		Promise.allSettled(promises).then(() => commandManager.fetch()).then(commands => {
			for(const command of commands.values())
				if(!loadedCommands.includes(command.name))
					command.delete().catch(error);
		});
	}
}

exports.init = (master, debug) => {
	const client = require("../bot").client;
	skipDebug = !debug;
	commandManager = (debug ? client.guilds.cache.first() : client.application).commands;
	commandManager.fetch().then(loadFolder.bind(null, __dirname));
}
