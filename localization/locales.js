
import { dictionary, deepFreeze } from "../utils/dictionaries.js";
import localesFile from "./locales.json" with { type: "json" };
export default localesFile;

const countryToLang = localesFile.countryToLang = dictionary();
for(const [lang, country] of Object.entries(localesFile.langToCountry))
    countryToLang[country] = lang;
for(const fr of localesFile.langCountries.french)
    countryToLang[fr] = "fr"
countryToLang.GB = countryToLang.US = "en";

const steamDefaultLanguages = localesFile.steamDefaultLanguages = dictionary();
for(const [language, countries] of Object.entries(localesFile.langCountries))
    for(const country of countries)
        steamDefaultLanguages[country] = language;

const languageCodes = localesFile.languageCodes = dictionary();
for(const [code, language] of Object.entries(localesFile.steamLanguages))
    languageCodes[language] = code;

deepFreeze(localesFile);