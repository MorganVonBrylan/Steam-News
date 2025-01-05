
import { stmts } from "../steam_news/db.js";
const { getCC, setCC } = stmts;
import importJSON from "../utils/importJSON.function.js";
const { codeToCountry } = importJSON("locales.json");

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
	const cc = inter.options.getString("country-code")?.toUpperCase();

	if(!cc)
	{
		const currentCC = getCC(inter.guildId);
		inter.reply(currentCC
			? t("current", currentCC, codeToCountry[currentCC])
			: t("no-default")
		);
	}
	else
	{
		if(cc.length !== 2)
			inter.reply({flags: "Ephemeral", content: t("cc-required", CC_LIST)});
		else if(!(cc in codeToCountry))
			inter.reply({flags: "Ephemeral", content: t("cc-invalid", CC_LIST)});
		else
		{
			setCC(inter.guildId, cc);
			inter.reply(t("new-default", cc, codeToCountry[cc]));
		}
	}
}
