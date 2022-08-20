"use strict";

const FALLBACK = "en";
const locales = {};

for(const file of require("fs").readdirSync(__dirname))
	if(file.endsWith(".json"))
		locales[file.substring(0, file.length-5)] = require("./"+file);

if(!locales[FALLBACK])
	throw new Error(`Missing fallback localization (${FALLBACK})`);


global.tr = exports.tr = {
	set(lang, group) {
		this.group = group;
		if(!(lang in locales))
			lang = "en";
		this.lang = lang;
		this.locale = locales[lang];
		if(this.group)
		{
			this.locale = this.locale[this.group];
			this.fallback = locales[FALLBACK][this.group];
		}
		else
			this.fallback = locales[FALLBACK];
		return this.t;
	},

	t(key, replaces = []) {
		const path = key.split(".");
		let obj = this.locale;
		for(let i = 0 ; i < path.length-1 ; ++i)
		{
			if(path[i] in obj)
				obj = path[i];
			else
			{
				error(`Missing ${this.lang} translation for ${key}`);
				obj = null;
				break;
			}
		}

		if(obj === null)
		{
			obj = this.fallback;
			for(let i = 0 ; i < path.length-1 ; ++i)
			{
				if(path[i] in obj)
					obj = path[i];
				else
				{
					error(`Missing fallback translation for ${key}`);
					obj = null;
					break;
				}
			}
		}

		let str = obj[path[path.length-1]];
		for(const replace of replaces)
			str = str.replace("%s", replace);
		return str;
	},
}

tr.locales = Object.keys(locales);
tr.fallbackLocale = FALLBACK;

tr.t = tr.t.bind(tr);
tr.set("en");



exports.applyTranslations = function(commandList)
{
	for(const [locale, {commands}] of Object.entries(locales))
	{
		if(locale === "en" || !commands)
			continue;

		for(const [cmdName, {name, description, options}] of Object.entries(commands))
		{
			const cmd = commandList[cmdName];
			if(cmd.nameLocalizations) cmd.nameLocalizations[locale] = name;
			else cmd.nameLocalizations = { [locale]: name };
			if(cmd.descriptionLocalizations) cmd.descriptionLocalizations[locale] = description;
			else cmd.descriptionLocalizations = { [locale]: description };

			if(!cmd.options)
				continue;
			if(!options)
			{
				console.warn(`Missing ${locale} option translations for command ${cmdName}`);
				continue;
			}

			for(const opt of cmd.options)
			{
				const tr = options[opt.name];
				if(tr)
				{
					const {name, description} = tr;
					if(opt.nameLocalizations) opt.nameLocalizations[locale] = name;
					else opt.nameLocalizations = { [locale]: name };
					if(opt.descriptionLocalizations) opt.descriptionLocalizations[locale] = description;
					else opt.descriptionLocalizations = { [locale]: description };
				}
				else
					console.warn(`Missing ${locale} translation for option ${option.name} of command ${cmdName}`);
			}
		}
	}
}
