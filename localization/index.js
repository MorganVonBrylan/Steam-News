// ref: https://discord.com/developers/docs/reference#locales

const dataFolder = `${import.meta.dirname}/data`;
const FALLBACK = "en";

export { FALLBACK as fallbackLocale };

import importJSON from "../utils/importJSON.function.js";
import { WATCH_LIMIT, WATCH_VOTE_BONUS } from "../steam_news/limits.js";
import localesFile from "./locales.js";

import { readdirSync } from "node:fs";
import { dictionary, deepFreeze } from "../utils/dictionaries.js";

import { dbl_link, dbl_url } from "../commands/filter/~data.js";

/**
 * @typedef {{name:string, description:string}} BaseData
 * @typedef {BaseData & {choices?:{[value:string]:string}}} CmdOption
 * @typedef {{name:string, description:string, options?:{[name:string]: CmdOption}}} Subcmd
 * @typedef {{name:string, description:string, options?:{[name:string]: SubcmdData}}} SubcmdGroup
 * @typedef {{name:string, description:string, options?:{[name:string]: CmdOption}|{[name:string]: Subcmd|SubcmdGroup}}} Command
 * @typedef {"ar"|"br"|"zh-CN"|"zh-TW"|"cs"|"da"|"nl"|"en"|"fi"|"fr"|"de"|"el"|"hu"|"it"|"ja"|"ko"|"no"|"pl"|"pt"|"pt-BR"|"ro"|"ru"|"es-ES"|"es-419"|"sv"|"th"|"tr"|"uk"|"vn"} LocaleName
 * @typedef {{[key:string]: string|string[]|LocaleEntry}} LocaleEntry
 * @typedef {LocaleEntry & {
 *   commands: { [cmdName:string]:Command },
 *   locale: LocaleEntry & { languages: {[lang:LocaleName]: string} },
 * }} Locale
 */
/** @type {{[locale:string]: Locale}} */
const locales = dictionary();

for(const file of readdirSync(dataFolder).filter(f => f.endsWith(".json")))
{
	const locale = importJSON(`${dataFolder}/${file}`);
	const localeName = file.substring(0, file.length - 5);
	locales[localeName] = locale;

	const { commands: { watch, latest, premium }, voting, filter } = locale;
	voting.thanks = voting.thanks.replace("%s", WATCH_VOTE_BONUS);
	const { options: { game, steam } } = watch;
	game.description = game.description.replace("%s", WATCH_LIMIT);
	Object.assign(game.options, steam.options);

	if(filter && dbl_url) for(const string in filter)
	{
		if(string === "help")
			filter.help.description = filter.help.description.replace("${dbl_link}", dbl_link);
		else if(string.includes("vote"))
			filter[string] = filter[string]
				.replace("${dbl_link}", dbl_link)
				.replace("${dbl_url}", dbl_url);
	}

	if(premium?.options?.chameleon?.options?.set?.options)
	{
		const chameleon = premium.options.chameleon.options;
		const { set: {options}, customize } = chameleon;
		if(customize)
			customize.options = options;
		else
			chameleon.customize = { options };
	}

	const { "game-news": gameLatest, "steam-news": steamLatest } = latest.options;
	steamLatest.options ??= {};
	steamLatest.options.language = gameLatest.options.language;

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


/** @type {{[lang:string]: Intl.DateTimeFormat}} */
const formatters = Object.create(null);
formatters.en = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
formatters["en-GB"] = formatters["en-US"] = formatters.en;
/**
 * Format a date to a short form with day, month and year.
 * @param {string} lang Language code (e.g fr, en, es-ES...)
 * @param {Date|number} [date] The date to format. Defaults to the current date.
 */
export function formatDate(lang, date)
{
	const formatter = formatters[lang] ??= new Intl.DateTimeFormat([lang, FALLBACK], { dateStyle: "medium" });
	return formatter.format(date);
}


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
 * @param {string} str The source string.
 * @param {string[]|object} replacements Either an array of replacements, or a plain object for named replacements.
 * @returns the strings with replaced substrings.
 * 
 * @example trReplace("I am %s, I live %s", ["Joe", "here"])
 * @example trReplace("I am ${name}, I live ${where}", {name: "Joe", where: "here"})
 */
export function trReplace(str, replacements)
{
	if(replacements.length === 1 && typeof replacements[0] === "object")
		replacements = replacements[0];
	return replacements instanceof Array
		? replacements.reduce((str, r) => str.replace("%s", r), str)
		: Object.entries(replacements).reduce((str, [key, r]) => str.replaceAll(`\${${key}}`, r), str);
}

/** @typedef {typeof tr.t} TranslatorFunction */

/** @global */
export const tr = Object.freeze({
	locales: Object.keys(locales),
	fallbackLocale: FALLBACK,

	/**
	 * Bind the translator function to a language and group
	 * @param {string} lang 
	 * @param {string} [group] 
	 * @returns the bound translator function
	 */
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
		t.lang = lang;
		t.plural = tr.plural.bind(t);
		return t;
	},

	/**
	 * Get a translation
	 * @param {string} lang 
	 * @param {string} key 
	 * @param  {...string|object} replacements 
	 */
	get(lang, key, ...replacements) {
		return trReplace(tr.set(lang)(key), replacements);
	},
	/**
	 * Get a translation in all languages
	 * @param {string} key 
	 * @param {boolean} skipFallback Whether to exclude the fallback locale from the result
	 * @param  {...string|object} replacements 
	 * @returns {{[locale:keyof locales]: string}}
	 */
	getAll(key, skipFallback = false, ...replacements) {
		const translations = {};
		for(const locale of tr.locales)
			if(!skipFallback || locale !== FALLBACK)
				translations[locale] = trReplace(tr.set(locale)(key), replacements);

		return translations;
	},

	/**
	 * @this {typeof tr.t}
	 * Get a translation with a proper plural. This must be called from a translation function.
	 * @param {string|{default:string,[n:number]:string}} keyOrPlurals The plurals data, or the key of the string
	 * @param {number} n The number
	 * @param  {...string} replacements 
	 * @returns {string}
	 */
	plural(keyOrPlurals, n, ...replacements) {
		const plurals = typeof keyOrPlurals === "object" ? keyOrPlurals : this(keyOrPlurals);
		let str = plurals[n] || plurals.default.replace("%n", n);
		for(const replace of replacements)
			str = str.replace("%s", replace);
		return str;
	},

	/**
	 * @this {{lang:keyof locales, locale:Locale, fallback:Locale}}
	 * Translate a string. This function must be bound to a language. @see {tr.set}
	 * @param {string} key 
	 * @param  {...string|object} replacements 
	 * @returns the translation
	 */
	t(key, ...replacements) {
		if(typeof key !== "string")
			throw new TypeError("'key' must be a string");

		const logError = knownIncomplete(this.lang)
			? Function.noop
			: (message) => error(Object.assign(
				new Error(message),
				{ locale: this.locale, key, replacements },
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

		return obj ? trReplace(obj, replacements) : key;
	},
});

export default tr;
global.tr = tr;



/**
 * Apply the translation on a command object. This is meant to be used as middleware for djs-commands.
 * @param {string} cmdName The command's name
 * @param {import("discord.js").ChatInputApplicationCommandData} cmd The command data
 */
export function applyTranslations(cmdName, cmd)
{
	if(cmd.subfolder === "~debug")
		return;

	const { commands, locale: {languages} } = locales[FALLBACK];
	// fallback check
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
	} // end of fallback check

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
		else
			cmd.options.forEach(applyOptionTranslation.bind({locale, languages, cmdName}, options));
	} // for(const [locale, {commands}] of Object.entries(locales))
}

/**
 * @this {{locale:string, languages:{[locale:string]:object}, cmdName:string}}
 * Apply the translation on a command object. This is meant to be used as middleware for djs-commands.
 * @param {Exclude<Command['options'], undefined>} translations The option translations
 * @param {import("discord.js").ApplicationCommandOptionData} opt The option getting translation applied to
 */
function applyOptionTranslation(translations, opt)
{
	const { locale } = this;
	const forOption = `translation for option ${opt.name} of command ${this.cmdName}`;
	const tr = translations[opt.name];
	if(!tr)
	{
		// /watch's subcommands share these options, which are not repeated for the sake of brevity
		if(this.cmdName !== "watch" || (opt.name !== "channel" && opt.name !== "role"))
			warnMissing(locale, `Missing %l ${forOption}`);
		return;
	}

	const { name, description } = tr;

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

	opt.options?.forEach(applyOptionTranslation.bind(this, tr.options));

	const nChoices = opt.choices?.length;
	if(!nChoices)
		return;

	const choices = opt.name === "language"
		? opt.choices.map(({value}) => this.languages[value])
		: tr.choices;
	
	if(nChoices !== choices?.length)
	{
		warnMissing(locale, `Mismatched number of choices in %l ${forOption} (expected ${nChoices}, got ${choices?.length})`);
		return;
	}

	for(let i = 0 ; i < nChoices ; ++i)
	{
		const choice = opt.choices[i];
		if(choice.nameLocalizations) choice.nameLocalizations[locale] = choices[i];
		else choice.nameLocalizations = { [locale]: choices[i] };
	}
}