
import dirname from "../utils/__dirname.js";
const __dirname = dirname(import.meta.url);

const FALLBACK = "en";
const locales = {};

export { FALLBACK as fallbackLocale };

import importJSON from "../utils/importJSON.function.js";
const { WATCH_LIMIT, WATCH_VOTE_BONUS } = importJSON("steam_news/limits.json");
const localesFile = importJSON("locales.json");

import { readdirSync } from "node:fs";

for(const file of readdirSync(__dirname).filter(f => f.endsWith(".json")))
{
	const locale = importJSON(`${__dirname}/${file}`);
	const localeName = file.substring(0, file.length - 5);
	locales[localeName] = locale;
	const { commands: { watch, latest }, voting } = locale;
	watch.description = watch.description.replace("%s", WATCH_LIMIT);
	voting.thanks = voting.thanks.replace("%s", WATCH_VOTE_BONUS);

	const steamLatest = locale.commands["steam-latest"];
	steamLatest.options ??= {};
	steamLatest.options.language = latest.options.language;

	const { locale: { languages } } = locale;
	if(!languages)
		console.warn(`Missing language name translations for ${localeName}`);
	else for(const [code, language] of Object.entries(languages))
		languages[localesFile.steamLanguages[code]] = language;
}

if(!locales[FALLBACK])
	throw new Error(`Missing fallback localization (${FALLBACK})`);

{
	const countryToLang = localesFile.countryToLang = {};
	for(const [lang, country] of Object.entries(localesFile.langToCountry))
		countryToLang[country] = lang;
	for(const fr of localesFile.langCountries.french)
		countryToLang[fr] = "fr"
	countryToLang.GB = countryToLang.US = "en";

	const steamDefaultLanguages = localesFile.steamDefaultLanguages = {};
	for(const [language, countries] of Object.entries(localesFile.langCountries))
		for(const country of countries)
			steamDefaultLanguages[country] = language;
	
	const languageCodes = localesFile.languageCodes = {};
	for(const [code, language] of Object.entries(localesFile.steamLanguages))
		languageCodes[language] = code;
}


/**
 * Replaces elements in a string for dynamic translation purposes.
 * @example
 * trReplace("I am %s, I live %s", ["Joe", "here"])
 * @example
 * trReplace("I am ${name}, I live ${where}", {name: "Joe", where: "here"})
 * 
 * @param {string} str The source string.
 * @param {Array<string>|object} replaces Either an array of replacements, or a plain object.
 * @returns {string} the strings with replaced substrings.
 */
export function trReplace(str, replaces)
{
	return replaces instanceof Array
		? replaces.reduce((str, r) => str.replace("%s", r), str)
		: Object.entries(replaces).reduce((str, [key, r]) => str.replaceAll(`\${${key}}`, r), str);
}


export const tr = {
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

		const logError = (message) => {
			error(Object.assign(new Error(message)), {
				locale: this.locale, key, replaces
			});
		}
		const path = key.split(".");
		let obj = this.locale;
		for(const part of path)
		{
			if(part in obj)
				obj = obj[part];
			else
			{
				logError(`Missing ${this.lang} translation for ${key}`);
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
					logError(`Missing fallback translation for ${key}`);
					obj = undefined;
					break;
				}
			}
		}

		return obj ? trReplace(obj, replaces) : key;
	},
}

export default tr;
global.tr = tr;

for(const prop in tr)
	if(typeof tr[prop] === "function")
		tr[prop] = tr[prop].bind(tr);

tr.set(FALLBACK);



/**
 * Apply the translation on a command object. This is meant to be used as middleware for djs-commands.
 * @param {string} cmdName The command's name
 * @param {object} cmd The command data
 */
export function applyTranslations(cmdName, cmd)
{
	if(cmd.subfolder === "~debug")
		return;

	const { commands, locale: {languages} } = locales[FALLBACK];

	if(!commands)
		console.warn("Missing fallback command translations");
	else if(!(cmdName in commands))
		console.warn(`Missing fallback translation for command ${cmdName}`);
	else
	{
		const {description, options} = commands[cmdName];
		if(!description)
			console.warn(`Missing fallback description for command ${cmdName}`);
		else
			cmd.description = description;

		if(cmd.options?.length)
		{
			if(!options)
				console.warn(`Missing fallback option translations for command ${cmdName}`);
			else for(const opt of cmd.options)
			{
				const forOption = `for option ${opt.name} of command ${cmdName}`;
				const tr = options[opt.name];
				if(!tr)
					console.warn(`Missing fallback translation ${forOption}`);
				else
				{
					const { description, choices } = tr;
					if(!description)
						console.warn(`Missing fallback description ${forOption}`);
					else
						opt.description = description;

					const nChoices = opt.choices?.length;
					if(nChoices)
					{
						if(nChoices !== choices?.length)
						{
							if(opt.name === "language")
								for(const choice of opt.choices)
									choice.name = languages[choice.value];
							else
								console.warn(`Mismatched number of fallback choices ${forOption} (expected ${nChoices}, got ${choices?.length})`);
						}
						else for(let i = 0 ; i < nChoices ; i++)
							opt.choices[i].name = choices[i];
					}
				}
			}
		}
	}

	for(const [locale, {commands, locale: {languages}}] of Object.entries(locales))
	{
		if(locale === FALLBACK)
			continue;

		if(!commands)
		{
			console.warn(`Missing ${locale} command translations`);
			continue;
		}

		if(!(cmdName in commands))
		{
			console.warn(`Missing ${locale} translation for command ${cmdName}`);
			continue;
		}


		const { name, description, options } = commands[cmdName];

		if(!name)
			console.warn(`Missing ${locale} name translation for command ${cmdName}`);
		else
		{
			if(cmd.nameLocalizations) cmd.nameLocalizations[locale] = name;
			else cmd.nameLocalizations = { [locale]: name };
		}

		if(!description)
			console.warn(`Missing ${locale} description translation for command ${cmdName}`);
		else
		{
			if(cmd.descriptionLocalizations) cmd.descriptionLocalizations[locale] = description;
			else cmd.descriptionLocalizations = { [locale]: description };
		}

		if(!cmd.options?.length)
			continue;

		if(!options)
			console.warn(`Missing ${locale} option translations for command ${cmdName}`);
		else for(const opt of cmd.options)
		{
			const forOption = `translation for option ${opt.name} of command ${cmdName}`;
			let tr = options[opt.name];
			if(!tr)
			{
				console.warn(`Missing ${locale} ${forOption}`);
				continue;
			}

			let { name, description, choices } = tr;

			if(!name)
				console.warn(`Missing ${locale} name ${forOption}`);
			else
			{
				if(opt.nameLocalizations) opt.nameLocalizations[locale] = name;
				else opt.nameLocalizations = { [locale]: name };
			}

			if(!description)
				console.warn(`Missing ${locale} description ${forOption}`);
			else
			{
				if(opt.descriptionLocalizations) opt.descriptionLocalizations[locale] = description;
				else opt.descriptionLocalizations = { [locale]: description };
			}

			const nChoices = opt.choices?.length;
			if(!nChoices)
				continue;

			if(nChoices !== choices?.length && opt.name === "language")
			{
				if(opt.name === "language")
					choices = opt.choices.map(l => languages[l]);
				else
				{
					console.warn(`Mismatched number of choices in ${locale} ${forOption} (expected ${nChoices}, got ${choices?.length})`);
					continue;
				}
			}

			for(let i = 0 ; i < nChoices ; ++i)
			{
				const choice = opt.choices[i];
				if(choice.nameLocalizations) choice.nameLocalizations[locale] = choices[i];
				else choice.nameLocalizations = { [locale]: choices[i] };
			}
		}
	} // for(const [locale, {commands}] of Object.entries(locales))
}
