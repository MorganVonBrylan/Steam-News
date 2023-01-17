"use strict";

const { search, getDetails, isNSFW } = require("../steam_news/api");
const { stmts: {getCC} } = require("../steam_news/db");
const { langToCountry } = require("../locales.json");

exports.dmPermission = true;
exports.autocomplete = require("../autocomplete/search");
exports.options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}, {
	type: STRING, name: "language",
	description: "The language to display info in (if unspecified, the server's default or your own locale)",
	choices: [
		{ name: "English (price in US$)", value: "en" },
		{ name: "English (price in pounds)", value: "en-UK" },
		{ name: "Français", value: "fr" },
		{ name: "My own locale", value: "own" },
	],
}];
exports.run = async inter => {
	const langOpt = inter.options.getString("language");
	const lang = langOpt && langOpt !== "own" ? langOpt : (
		getCC(inter.guild?.id)?.toLowerCase() || inter.locale || "en"
	);
	const defer = inter.deferReply().catch(error);
	let appid = inter.options.getString("game");

	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return defer.then(() => inter.editReply({ephemeral: true, content: tr.get(inter.locale, "no-match", appid)}).catch(error));
	}

	const t = tr.set(lang, "info");

	getDetails(appid, lang, langToCountry[lang]).then(async details => {
		await defer;
		if(!details)
			return inter.editReply({ephemeral: true, content: t("invalidAppid")}).catch(error);

		const {
			type, fullgame,
			steam_appid, developers, website,
			name, header_image, release_date: {date = t("comingSoon")},
			genres = [], metacritic,
			controller_support, platforms, categories,
			dlc, is_free, price_overview: price = {}, // is_free can be false and price_overview undefined if the game is not out yet
			supported_languages,
		} = details;
		const nsfw = isNSFW(details);

		if(nsfw && !inter.channel.nsfw) // temporary
			return inter.editReply({ephemeral: true, content: t("nsfwForbidden")}).catch(error);

		inter.editReply({ embeds: [{
			url: "https://store.steampowered.com/app/"+steam_appid,
			title: name,
			author: developers ? { name: developers.join(", "), url: website } : null,
			provider: { name: "Steam", url: "https://store.steampowered.com/" },
			description: details.short_description,
			fields: [
				{ name: genres.length > 1 ? t("genres") : t("genre"), value: genres.length ? genres.map(g => g.description).join(", ") : t("none"), inline: true },
				{ name: t("metacritic"), value: metacritic ? `[${metacritic.score}](${metacritic.url})` : t("unknown"), inline: true },
				{ name: t("nsfw"), value: nsfw ? `🔞 ${t("yes")}` : t("no"), inline: true },
				{ name: t("releaseDate"), value: date, inline: true },
				{ name: t("price"), value: is_free && !price.discount_percent ? t("free") : displayPrice(price), inline: true },
				{ name: t("DLC"), value: type === "dlc"
					? `${t("game")} ${fullgame.name} (${fullgame.appid})`
					: (dlc?.length || 0)+"", inline: true },
				{ name: t("platforms"), value: listPlatforms(platforms) || t("unknown"), inline: true },
				{ name: t("controllerSupport"), value: controller_support === "full" ? t("yes") : t("no"), inline: true },
				{ name: t("multi"), value: categories.some(({id}) => id === 1) ? t("yes") : t("no"), inline: true },
				{ name: t("languages"), value: parseLanguages(supported_languages) },
				{ name: t("openInApp"), value: `steam://store/${appid}` },
			],
			image: { url: header_image },
		}] }).catch(error);
	}).catch(err => console.error(`appid: ${appid}`, err));
}


function displayPrice({discount_percent, initial_formatted, final_formatted})
{
	return `${final_formatted}${discount_percent ? ` (-${discount_percent}%)` : ""}`;
}

function listPlatforms(platforms)
{
	return Object.entries(platforms || {})
		.filter(([,supported]) => supported)
		.map(([name]) => name.replace(/(?:^|\s|-)\S/g, a => a.toUpperCase()))
		.join(", ");
}

function parseLanguages(html)
{
	return html.replaceAll(/\*/g, "\\*")
		.replaceAll(/<br\/?>(.+)/g, "\n_$1_")
		.replaceAll(" - ", " – ") // espace insécables
		.replaceAll(/<\/?(strong|b)>/g, "**")
		.replaceAll(/<\/?(em|i)>/g, "_");
}
