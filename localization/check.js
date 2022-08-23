"use strict";

const { fallbackLocale } = require(".");

const NAME_REGEX = /^[a-z_-]{1,32}$/;
const DESC_MAX_LENGTH = 100;

const mainLocale = {};
const locales = new Map();

for(const file of require("fs").readdirSync(__dirname))
	if(file.endsWith(".json"))
	{
		if(file === `${fallbackLocale}.json`)
			Object.assign(mainLocale, require("./"+file));
		else
			locales.set(file.substring(0, file.length-5), require("./"+file));
	}


for(const [locale, trData] of locales)
{
	console.log("\nChecking", locale);
	Object.entries(trData.commands).forEach(checkCommand);
	checkGroup(mainLocale, trData);
}


function checkCommand([cmd, {name, description, options = {}}])
{
	if(!name)
		console.error(`Command ${cmd} is missing a name`);
	else if(!NAME_REGEX.test(name))
		console.error(`Command ${cmd} has an invalid name (may be too long or have invalid characters)`);
	if(!description)
		console.error(`Command ${cmd} is missing a description`);
	else if(description.length > DESC_MAX_LENGTH)
		console.error(`Command ${cmd}'s description is too long (${description.length}/${DESC_MAX_LENGTH})`);

	for(const [optName, {name, description}] of Object.entries(options))
	{
		if(!name)
			console.error(`Command ${cmd}'s option ${optName} is missing a name`);
		else if(!NAME_REGEX.test(name))
			console.error(`Command ${cmd}'s option ${optName} has an invalid name (may be too long or have invalid characters)`);
		if(!description)
			console.error(`Command ${cmd}'s option ${optName} is missing a description`);
		else if(description.length > DESC_MAX_LENGTH)
			console.error(`Command ${cmd}'s option ${optName}'s description is too long (${description.length}/${DESC_MAX_LENGTH})`);
	}
}

function checkGroup(group, localeGroup, path = "")
{
	for(const [key, value] of Object.entries(group))
	{
		const keyPath = path ? `${path}.${key}` : key;
		if(!(key in localeGroup))
			console.error(`Missing ${keyPath}`);
		else if(typeof value !== typeof localeGroup[key])
			console.error(`${keyPath} is a ${typeof localeGroup[key]}, should be a ${typeof value}`);
		else if(typeof value === "object")
			checkGroup(value, localeGroup[key], keyPath);
		else if(typeof value === "string")
		{
			const reqPlaceholders = value.match(/%s/g)?.length || 0;
			const gotPlaceholders = localeGroup[key].match(/%s/g)?.length || 0;
			if(reqPlaceholders !== gotPlaceholders)
				console.error(`${keyPath} has ${gotPlaceholders} placeholders, should have ${reqPlaceholders}`);
		}
	}
}
