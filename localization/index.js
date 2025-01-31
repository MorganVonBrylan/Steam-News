
import dirname from "../utils/__dirname.js";
const __dirname = dirname(import.meta.url);

const FALLBACK = "en";
const locales = {};

export { FALLBACK as fallbackLocale };

import importJSON from "../utils/importJSON.function.js";
const { WATCH_LIMIT, WATCH_VOTE_BONUS } = importJSON("steam_news/limits.json");
import applyTranslations from "./applyTranslations.function.js";

import { readdirSync } from "node:fs";

for(const file of readdirSync(__dirname).filter(f => f.endsWith(".json")))
{
	const locale = importJSON(`${__dirname}/${file}`);
	locales[file.substring(0, file.length - 5)] = locale;
	const { commands: { watch }, voting } = locale;
	watch.description = watch.description.replace("%s", WATCH_LIMIT);
	voting.thanks = voting.thanks.replace("%s", WATCH_VOTE_BONUS);
}

if(!locales[FALLBACK])
	throw new Error(`Missing fallback localization (${FALLBACK})`);

{
	const localesFile = importJSON("locales.json");
	const countryToLang = localesFile.countryToLang = {};
	for(const [lang, country] of Object.entries(localesFile.langToCountry))
		countryToLang[country] = lang;
	for(const fr of localesFile.francophones)
		countryToLang[fr] = "fr"
	countryToLang.GB = countryToLang.US = "en";
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

	applyTranslations: applyTranslations.bind({FALLBACK, locales}),

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

		function logError(message) {
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
