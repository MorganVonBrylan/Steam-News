
import { stmts } from "../steam_news/db.js";
const { getCC, getLocale, setLocale } = stmts;
import importJSON from "../utils/importJSON.function.js";
const {
	codeToCountry,
	steamLanguages, steam_exclude,
	steamDefaultLanguages,
} = importJSON("locales.json");

export { steamLanguages };

const CC_LIST = "You can find the list here: https://www.iban.com/country-codes";
const countryNames = Object.values(codeToCountry).map(name => name.toUpperCase());
const countryToCode = {};
for(const [cc, country] of Object.entries(codeToCountry))
	countryToCode[country.toUpperCase()] = cc;

export const defaultMemberPermissions = "0";
export const options = [{
	type: STRING, name: "country-code",
	description: "Your 2-letter country code, like GB, FR, RU, etc. You can also make a search.",
	autocomplete: true,
}, {
	type: STRING, name: "language",
	description: "Your preferred language for news. Defaults to your country's official language.",
	choices: Object.keys(steamLanguages)
		.filter(l => !steam_exclude.includes(l))
		.map(value => ({ value })),
}];
export function autocomplete(inter)
{
	const search = inter.options.getFocused().toUpperCase();
	const results = countryNames.filter(name => name.includes(search));
	if(search in codeToCountry)
		results.unshift(codeToCountry[search].toUpperCase());
	if(results.length > 25)
		results.length = 25;

	inter.respond(results.map(upperName => {
		const cc = countryToCode[upperName];
		return { name: codeToCountry[cc], value: cc };
	}));
};
export function run(inter)
{
	const t = tr.set(inter.locale, "locale");
	let cc = inter.options.getString("country-code")?.toUpperCase();
	let lang = inter.options.getString("language");

	if(!cc && !lang)
	{
		const current = getLocale(inter.guildId);
		inter.reply(current
			? t("current", current.cc, codeToCountry[current.cc], t("languages."+current.lang))
			: t("no-default")
		);
	}
	else
	{
		if(!cc)
			cc = getCC(inter.guildId);

		if(cc.length !== 2)
			inter.reply({flags: "Ephemeral", content: t("cc-required", CC_LIST)});
		else if(!(cc in codeToCountry))
			inter.reply({flags: "Ephemeral", content: t("cc-invalid", CC_LIST)});
		else
		{
			let lang = inter.options.getString("language");
			lang = lang ? steamLanguages[lang] : steamDefaultLanguages[cc];
			setLocale(inter.guildId, cc, lang);
			inter.reply(t("new-default", cc, codeToCountry[cc], t("languages."+lang)));
		}
	}
}
