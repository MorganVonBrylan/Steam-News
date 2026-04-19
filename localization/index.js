// ref: https://discord.com/developers/docs/reference#locales

const dataFolder = `${import.meta.dirname}/data`;
const FALLBACK = "en";

export { FALLBACK as fallbackLocale };

import importJSON from "../utils/importJSON.function.js";
import { WATCH_LIMIT, WATCH_VOTE_BONUS } from "../steam_news/limits.js";
import localesFile from "./locales.js";

import { readdirSync } from "node:fs";
import { dictionary, deepFreeze } from "../utils/dictionaries.js";

const locales = dictionary();

for(const file of readdirSync(dataFolder).filter(f => f.endsWith(".json")))
{
	const locale = importJSON(`${dataFolder}/${file}`);
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

locales["en-GB"] = locales[FALLBACK];
locales["en-US"] = locales[FALLBACK];
deepFreeze(locales);


const incompleteTrs = importJSON(`${import.meta.dirname}/knownIncompleteTrs.json`, []);
if(!Array.isArray(incompleteTrs))
	throw new TypeError("knownIncompleteTrs.json has an invalid format. Expected: array");

if(incompleteTrs.length)
	console.warn(`Known incomplete translations: ${incompleteTrs.join(", ")}. Missing strings will be ignored.`);

const knownIncomplete = incompleteTrs.length ? incompleteTrs.includes.bind(incompleteTrs) : Function.noop;

function warnMissing(language, message)
{
	if(!knownIncomplete(language))
		console.warn(message.replace("%l", language));
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
	if(replaces.length === 1 && typeof replaces[0] === "object")
		replaces = replaces[0];
	return replaces instanceof Array
		? replaces.reduce((str, r) => str.replace("%s", r), str)
		: Object.entries(replaces).reduce((str, [key, r]) => str.replaceAll(`\${${key}}`, r), str);
}


export const tr = {
	locales: Object.keys(locales),
	fallbackLocale: FALLBACK,
	locale: FALLBACK,

	set(lang, group) {
		if(!(lang in locales))
			lang = FALLBACK;

		let fallback = locales[FALLBACK];
		let locale = locales[lang] || fallback;
		if(group)
		{
			const subGroups = group.split(".");
			group = "";
			for(const subGroup of subGroups)
			{
				group += `.${subGroup}`;
				fallback = fallback[subGroup];
				if(subGroup in locale)
					locale = locale[subGroup];
				else
				{
					locale = fallback;
					warnMissing(lang, `Missing ${group} subgroup in %l translation.`);
				}
			}
		}
		const t = this.t.bind({ lang, locale, fallback });
		t.plural = tr.plural.bind(t);
		return t;
	},

	get(lang, key, ...replaces) {
		return trReplace(tr.set(lang)(key), replaces);
	},
	getAll(key, skipFallback = false, ...replaces) {
		const translations = {};
		for(const locale of tr.locales)
			if(!skipFallback || locale !== FALLBACK)
				translations[locale] = trReplace(tr.set(locale)(key), replaces);

		return translations;
	},

	plural(keyOrPlurals, n, ...replaces) {
		const plurals = typeof keyOrPlurals === "object" ? keyOrPlurals : this(keyOrPlurals);
		let str = plurals[n] || plurals.default.replace("%n", n);
		for(const replace of replaces)
			str = str.replace("%s", replace);
		return str;
	},

	t(key, ...replaces) {
		if(typeof key !== "string")
			throw new TypeError("'key' must be a string");

		const logError = knownIncomplete(this.lang)
			? Function.noop
			: (message) => error(Object.assign(
				new Error(message),
				{ locale: this.locale, key, replaces },
			));
		
		const path = key.split(".");
		let obj = this.locale;
		for(const part of path)
		{
			if(part in obj)
				obj = obj[part];
			else
			{
				if(!process.env.DEBUG)
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
};

Object.freeze(tr);
export default tr;
global.tr = tr;



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
			warnMissing(locale, "Missing %l command translations");
			continue;
		}

		if(!(cmdName in commands))
		{
			warnMissing(locale, `Missing %l translation for command ${cmdName}`);
			continue;
		}


		const { name, description, options } = commands[cmdName];

		if(!name)
			warnMissing(locale, `Missing %l name translation for command ${cmdName}`);
		else
		{
			if(cmd.nameLocalizations) cmd.nameLocalizations[locale] = name;
			else cmd.nameLocalizations = { [locale]: name };
		}

		if(!description)
			warnMissing(locale, `Missing %l description translation for command ${cmdName}`);
		else
		{
			if(cmd.descriptionLocalizations) cmd.descriptionLocalizations[locale] = description;
			else cmd.descriptionLocalizations = { [locale]: description };
		}

		if(!cmd.options?.length)
			continue;

		if(!options)
			warnMissing(locale, `Missing %l option translations for command ${cmdName}`);
		else for(const opt of cmd.options)
		{
			const forOption = `translation for option ${opt.name} of command ${cmdName}`;
			let tr = options[opt.name];
			if(!tr)
			{
				warnMissing(locale, `Missing %l ${forOption}`);
				continue;
			}

			let { name, description, choices } = tr;

			if(!name)
				warnMissing(locale, `Missing %l name ${forOption}`);
			else
			{
				if(opt.nameLocalizations) opt.nameLocalizations[locale] = name;
				else opt.nameLocalizations = { [locale]: name };
			}

			if(!description)
				warnMissing(locale, `Missing %l description ${forOption}`);
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
					choices = opt.choices.map(({value}) => languages[value]);
				else
				{
					warnMissing(locale, `Mismatched number of choices in %l ${forOption} (expected ${nChoices}, got ${choices?.length})`);
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
