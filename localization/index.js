"use strict";

const FALLBACK = "en";
const locales = {};

const { WATCH_LIMIT, WATCH_VOTE_BONUS } = require("../steam_news/limits");

for(const file of require("fs").readdirSync(__dirname))
	if(file.endsWith(".json"))
	{
		const locale = locales[file.substring(0, file.length-5)] = require("./"+file);
		const { commands: { watch }, voting } = locale;
		watch.description = watch.description.replace("%s", WATCH_LIMIT);
		voting.thanks = voting.thanks.replace("%S", WATCH_VOTE_BONUS);
	}

if(!locales[FALLBACK])
	throw new Error(`Missing fallback localization (${FALLBACK})`);


{
	const localesFile = require("../locales.json");
	const countryToLang = localesFile.countryToLang = {};
	for(const [lang, country] of Object.entries(localesFile.langToCountry))
		countryToLang[country] = lang;
	for(const fr of localesFile.francophones)
		countryToLang[fr] = "fr"
	countryToLang.GB = countryToLang.US = "en";
}


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
			lang = FALLBACK;
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
		if(typeof key !== "string")
			throw new TypeError("'key' must be a string");

		const path = key.split(".");
		let obj = this.locale;
		for(const part of path)
		{
			if(part in obj)
				obj = obj[part];
			else
			{
				error(`Missing ${this.lang} translation for ${key}`);
				obj = undefined;
				break;
			}
		}

		if(obj === undefined)
		{
			obj = this.fallback;
			for(const part of path)
			{
				if(part in obj)
					obj = obj[part];
				else
				{
					error(`Missing fallback translation for ${key}`);
					obj = undefined;
					break;
				}
			}
		}

		return obj ? trReplace(obj, replaces) : key;
	},
}


for(const prop in tr)
	if(typeof tr[prop] === "function")
		tr[prop] = tr[prop].bind(tr);

tr.set(FALLBACK);


exports.cmdDescription = cmdName => locales[FALLBACK].commands[cmdName].description;

exports.applyTranslations = function(commandList)
{
	for(const [locale, {commands}] of Object.entries(locales))
	{
		if(locale === FALLBACK || !commands)
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
