"use strict";

const FALLBACK = "en";
const locales = {};

const WATCH_LIMIT = 25;

for(const file of require("fs").readdirSync(__dirname))
	if(file.endsWith(".json"))
	{
		const locale = locales[file.substring(0, file.length-5)] = require("./"+file);
		const { commands: { watch } } = locale;
		watch.description = watch.description.replace("%s", WATCH_LIMIT);
	}

if(!locales[FALLBACK])
	throw new Error(`Missing fallback localization (${FALLBACK})`);


function trReplace(str, replaces)
{
	return replaces.reduce((str, r) => str.replace("%s", r), str);
}


global.tr = module.exports = exports = {
	locales: Object.keys(locales),
	fallbackLocale: FALLBACK,

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

	get(lng, key, ...replaces) {
		const {lang, group} = tr;
		const translation = trReplace(tr.set(lng)(key), replaces);
		tr.set(lang, group);
		return translation;
	},
	getAll(key, skipFallback = false, ...replaces) {
		const {lang, group} = tr;
		const translations = {};
		for(const locale of tr.locales)
			if(!skipFallback || locale !== FALLBACK)
				translations[locale] = trReplace(tr.set(locale)(key), replaces);

		tr.set(lang, group);
		return translations;
	},

	plural(keyOrPlurals, n, ...replaces) {
		const plurals = typeof keyOrPlurals === "object" ? keyOrPlurals : tr.t(keyOrPlurals);
		let str = plurals[n] || plurals.default.replace("%n", n);
		for(const replace of replaces)
			str = str.replace("%s", replace);
		return str;
	},

	t(key, ...replaces) {
		const path = key.split(".");
		let obj = this.locale;
		for(let i = 0 ; i < path.length-1 ; ++i)
		{
			if(path[i] in obj)
				obj = obj[path[i]];
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

		return trReplace(obj[path[path.length-1]], replaces);
	},
}


for(const prop in tr)
	if(typeof tr[prop] === "function")
		tr[prop] = tr[prop].bind(tr);

tr.set("en");


exports.cmdDescription = cmdName => locales[FALLBACK].commands[cmdName].description;

exports.applyTranslations = function(commandList)
{
	for(const [locale, {commands}] of Object.entries(locales))
	{
		if(locale === "en" || !commands)
			continue;

		for(const [cmdName, {name, description, options}] of Object.entries(commands))
		{
			const cmd = commandList[cmdName];
			if(!cmd)
				continue;

			if(cmd.nameLocalizations) cmd.nameLocalizations[locale] = name;
			else cmd.nameLocalizations = { [locale]: name };
			if(cmd.descriptionLocalizations) cmd.descriptionLocalizations[locale] = description;
			else cmd.descriptionLocalizations = { [locale]: description };

			if(!cmd.options?.length)
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
					const {name, description, choices} = tr;
					if(opt.nameLocalizations) opt.nameLocalizations[locale] = name;
					else opt.nameLocalizations = { [locale]: name };
					if(opt.descriptionLocalizations) opt.descriptionLocalizations[locale] = description;
					else opt.descriptionLocalizations = { [locale]: description };

					if(opt.choices)
					{
						if(opt.choices.length !== choices?.length)
							console.warn(`Mismatched number of choices in ${locale} translation for option ${opt.name} of command ${cmdName} (expected ${opt.choices.length}, got ${choices?.length})`);
						else for(let i = 0 ; i < choices.length ; ++i)
						{
							const choice = opt.choices[i];
							if(choice.nameLocalizations) choice.nameLocalizations[locale] = choices[i];
							else choice.nameLocalizations = { [locale]: choices[i] };
						}
					}
				}
				else
					console.warn(`Missing ${locale} translation for option ${opt.name} of command ${cmdName}`);
			}
		}
	}
}
