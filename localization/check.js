"use strict";

const { tr: { fallbackLocale } } = require(".");


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
	checkGroup(mainLocale, trData);
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
	}
}
