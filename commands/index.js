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
		throw new LoadError(name, `Nom de commande trop long (${name.length})`);
	if(!/^[\w-]{1,32}$/.test(name))
		throw new LoadError(name, `Nom de commande invalide : ${name}`);

	if(commands[name] && commands[name].module !== cmdModule)
		throw new LoadError(name, `Impossible d'enregistrer la commande ${name} du module "${cmdModule}", elle existe déjà dans le module "${commands[name].module}"`);

	const file = `./${cmdModule}${cmdModule ? "/" : ""}${name}.js`;
	//delete require.cache[file];
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
}


function loadFolder(path, commandManager)
{
	const cmdModule = path.substring(__dirname.length + 1);

	for(const file of readdirSync(path))
	{
		if(file === "index.js" || file === "debug" && skipDebug)
			continue;

		if(file.endsWith(".js"))
			load(file, cmdModule);
		else
			loadFolder(`${path}/${file}`);
	}

	if(commandManager)
		commandManager.set(Object.values(commands));
}

exports.init = (client, debug) => {
	skipDebug = !debug;
	const commandManager = (debug ? client.guilds.cache.first() : client.application).commands;
	loadFolder(__dirname, commandManager);
}
