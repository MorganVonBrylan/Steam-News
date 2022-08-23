"use strict";

const CC_LIST = "You can find the list here: https://www.iban.com/country-codes";

const { stmts: {getCC, setCC} } = require("../steam_news/db");
const { codeToCountry } = require("../locales.json");

exports.defaultMemberPermissions = "0";
exports.autocomplete = searchCountry;
exports.options = [{
	type: STRING, name: "country-code",
	description: "Your 2-letter country code, like GB, FR, RU, etc. You can also make a search.",
	autocomplete: true,
}];
exports.run = inter => {
	const t = tr.set(inter.locale, "locale");
	const cc = inter.options.getString("country-code")?.toUpperCase();

	if(!cc)
	{
		const currentCC = getCC(inter.guild.id);
		inter.reply(currentCC
			? t("current", currentCC, codeToCountry[currentCC])
			: t("no-default")
		).catch(error);
	}
	else
	{
		if(cc.length !== 2)
			inter.reply({ephemeral: true, content: t("cc-required", CC_LIST)}).catch(error);
		else if(!(cc in codeToCountry))
			inter.reply({ephemeral: true, content: t("cc-invalid", CC_LIST)}).catch(error);
		else
		{
			setCC(inter.guild.id, cc);
			inter.reply(t("new-default", cc, codeToCountry[cc])).catch(error);
		}
	}
}


const countryNames = Object.values(codeToCountry).map(name => name.toUpperCase());
const countryToCode = {};
for(const [cc, country] of Object.entries(codeToCountry))
	countryToCode[country.toUpperCase()] = cc;

function searchCountry(inter)
{
	const search = inter.options.getFocused().toUpperCase();
	const results = countryNames.filter(name => name.includes(search));
	if(results.length > 25)
		results.length = 25;

	inter.respond(results.map(upperName => {
		const cc = countryToCode[upperName];
		return { name: codeToCountry[cc], value: cc };
	})).catch(error);
}
