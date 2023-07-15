"use strict";

const { fallbackLocale } = require(".");
const embeds = ["help"];

const { NAME_REGEX } = require("@brylan/djs-commands/checkCommand.function");
const DESC_MAX_LENGTH = 100;

const EMBED_MAX_LENGTH = Object.freeze({
	TITLE: 256,
	DESCRIPTION: 2048,
	FIELD_NUMBER: 25,
	FIELD_NAME: 256,
	FIELD_VALUE: 1024,
});

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
	console.log("\n => Checking", locale);
	Object.entries(trData.commands).forEach(checkCommand);
	checkGroup(mainLocale, trData);
	for(const embed of embeds)
		checkEmbed(trData[embed], embed);
}


function checkCommand([cmd, {name, description, options = {}}])
{
	if(!name)
		console.error(`Command ${cmd} is missing a name`);
	else if(!NAME_REGEX.test(name))
		console.error(`Command ${cmd} has an invalid name (may be too long or have invalid characters)`);
	else if(name !== name.toLowerCase())
		console.error(`Command ${cmd} has uppercase characters in its name`);
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
		{
			if(value instanceof Array)
			{
				const {length} = localeGroup[key];
				if(value.length !== length)
					console.warn(`${keyPath} has a different length (${length} versus ${value.length} in the original locale)`);
			}
			else
				checkGroup(value, localeGroup[key], keyPath);
		}
		else if(typeof value === "string")
		{
			if(!value.length)
				console.warn(`${keyPath} is an empty string`);

			const reqPlaceholders = value.match(/%s/g)?.length || 0;
			const gotPlaceholders = localeGroup[key].match(/%s/g)?.length || 0;
			if(reqPlaceholders !== gotPlaceholders)
				console.error(`${keyPath} has ${gotPlaceholders} placeholders, should have ${reqPlaceholders}`);
		}
	}
}

function checkEmbed({title = "", description = "", fields = []}, embedName)
{
	const { TITLE, DESCRIPTION, FIELD_NUMBER, FIELD_NAME, FIELD_VALUE } = EMBED_MAX_LENGTH;
	if(title.length > TITLE)
		console.error(`Embed '${embedName}' has a title too long (${title.length}/${TITLE})`);

	if(description.length > DESCRIPTION)
		console.error(`Embed '${embedName}' has a description too long (${description.length}/${DESCRIPTION})`);

	if(fields.length > FIELD_NUMBER)
		console.error(`Embed '${embedName}' has over ${FIELD_NUMBER} fields (${fields.length})`);

	let i = 0;
	for(const {name, value} of fields)
	{
		const err = `Field [${i++}] of embed '${embedName}'`;
		if(typeof name !== "string")
			console.error(`${err} has a non-string name`);
		else if(name.length > FIELD_NAME)
			console.error(`${err} has a name too long (${name.length}/${FIELD_NAME})`);

		if(typeof value !== "string")
			console.error(`${err} has a non-string value`);
		else if(value.length > FIELD_VALUE)
			console.error(`${err} has a value too long (${value.length}/${FIELD_VALUE})`);
	}
}
