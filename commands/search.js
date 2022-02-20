"use strict";

const { search } = require("../steam_news/api");

exports.description = "Make a search on the Steam store.";
exports.options = [{
	type: "STRING", name: "term", required: true,
	description: "The search term",
}, {
	type: "STRING", name: "country",
	description: "Your country code, e.g. FR for France, RU for Russia, etc. This is used to the price. Default: US.",
},];
exports.run = inter => {
	const term = inter.options.getString("term");
	const cc = (inter.options.getString("country") || "US").toUpperCase();

	if(term.length > 200)
		return inter.reply({ content: "The search term may not exceed 200 characters.", ephemeral: true }).catch(error);

	if(cc.length !== 2 && !validCountryCodes.includes(cc))
		return inter.reply({ content: "For the country you must specify its 2-letter code.\nIf you don't know what it is, your can find it here: https://www.iban.com/country-codes (Alpha-2 code)", ephemeral: true }).catch(error);

	search(term, cc).then(results => {
		if(!results.length)
			return inter.reply({ content: `The search for "${term}" yielded no results.`, ephemeral: true }).catch(error);

		inter.reply({ephemeral: true, embeds: [{
			title: `Search for "${term}"`,
			description: `${results.length} results`,
			fields: results.map(({id, name, price, metascore}) => ({
				name,
				value: `Id: **${id}**
Price: ${price ? `${price.final/100} ${currencies[price.currency] || price.currency}` : "free"}${metascore ? `
Metascore: ${metascore}` : ""}
[Store page](https://store.steampowered.com/app/${id})`,
			})),
		}]}).catch(error);
	});
}

const currencies = { EUR: "€", USD: "$", GBP: "£", JPY: "¥", CNY: "元", RUB: "₽" };

const validCountryCodes = ["AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CD", "CG", "CK", "CR", "HR", "CU", "CW", "CY", "CZ", "CI", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "MK", "RO", "RU", "RW", "RE", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "UM", "US", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW", "AX"];
