"use strict";

const { search, getDetails, isNSFW } = require("../steam_news/api");
const { stmts: {getCC} } = require("../steam_news/db");
const { langToCountry } = require("../locales.json");

exports.global = true;
exports.autocomplete = require("../autocomplete/search");
exports.description = "See info about a game (genre, price, release date, etc)";
exports.options = [{
	type: "STRING", name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}, {
	type: "STRING", name: "language",
	description: "The language to display info in (if unspecified, the server's default or your own locale)",
	choices: [
		{ name: "English (price in US$)", value: "en" },
		{ name: "English (price in pounds)", value: "en-UK" },
		{ name: "Français", value: "fr" },
	],
}];
exports.run = async inter => {
	const lang = inter.options.getString("language") || getCC(inter.guild?.id)?.toLowerCase() || inter.locale || "en";
	const tr = languages[lang] || languages.en;
	const defer = inter.deferReply().catch(error);
	let appid = inter.options.getString("game");

	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return defer.then(() => inter.editReply({ephemeral: true, content: `No game matching "${appid}" found.`}).catch(error));
	}

	getDetails(appid, lang, langToCountry[lang]).then(async details => {
		await defer;
		if(!details)
			return inter.editReply({ephemeral: true, content: tr.invalidAppid}).catch(error);

		const {
			type, fullgame,
			steam_appid, developers, website,
			name, header_image, release_date: {date = tr.comingSoon},
			genres = [], metacritic,
			controller_support, platforms, categories,
			dlc, is_free, price_overview: price = {}, // is_free can be false and price_overview undefined if the game is not out yet
			supported_languages,
		} = details;
		const nsfw = isNSFW(details);

		if(nsfw && !inter.channel.nsfw) // temporary
			return inter.editReply({ephemeral: true, content: tr.nsfwForbidden}).catch(error);

		inter.editReply({ embeds: [{
			url: "https://store.steampowered.com/app/"+steam_appid,
			title: name,
			author: developers ? { name: developers.join(", "), url: website } : null,
			provider: { name: "Steam", url: "https://store.steampowered.com/" },
			description: details.short_description,
			fields: [
				{ name: genres.length > 1 ? tr.genres : tr.genre, value: genres.length ? genres.map(g => g.description).join(", ") : tr.none, inline: true },
				{ name: tr.metacritic, value: metacritic ? `[${metacritic.score}](${metacritic.url})` : tr.unknown, inline: true },
				{ name: tr.nsfw, value: nsfw ? `🔞 ${tr.yes}` : tr.no, inline: true },
				{ name: tr.releaseDate, value: date, inline: true },
				{ name: tr.price, value: is_free && !price.discount_percent ? tr.free : displayPrice(price), inline: true },
				{ name: tr.DLC, value: type === "dlc"
					? `${tr.game} ${fullgame.name} (${fullgame.appid})`
					: (dlc?.length || 0)+"", inline: true },
				{ name: tr.platforms, value: platforms?.length ? listPlatforms(platforms) : tr.unknown, inline: true },
				{ name: tr.controllerSupport, value: controller_support === "full" ? tr.yes : tr.no, inline: true },
				{ name: tr.multi, value: categories.some(({id}) => id === 1) ? tr.yes : tr.no, inline: true },
				{ name: tr.languages, value: parseLanguages(supported_languages) },
				{ name: tr.openInApp, value: `steam://store/${appid}` },
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
	return Object.entries(platforms)
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


const languages = {
	en: {
		yes: "Yes", no: "No",
		invalidAppid: "The id you provided does not belong to any Steam app.",
		nsfwForbidden: "This game has adult content. You can only display its info in a NSFW channel.",
		comingSoon: "*coming soon*",
		genre: "Genre", genres: "Genres", none: "*none*",
		metacritic: "Metacritic score", unknown: "*Unknown*",
		nsfw: "NSFW",
		releaseDate: "Release date",
		price: "Price", free: "Free",
		DLC: "DLC", game: "Game:",
		platforms: "Platforms",
		controllerSupport: "Controller support",
		multi: "Multiplayer",
		languages: "Languages",
		openInApp: "Open in app",
	},
	fr: {
		yes: "Oui", no: "Non",
		invalidAppid: "Cet id ne correspond à aucune appli Steam.",
		nsfwForbidden: "Ce jeu a du contenu adulte. Vous ne pouvez afficher ses infos que dans un salon NSFW.",
		comingSoon: "*bientôt*",
		genre: "Genre", genres: "Genres", none: "*aucun*",
		metacritic: "Score Metacritic", unknown: "*Inconnu*",
		nsfw: "NSFW",
		releaseDate: "Date de publication",
		price: "Prix", free: "Gratuit",
		DLC: "DLC", game: "Jeu :",
		platforms: "Plateformes",
		controllerSupport: "Support manette",
		multi: "Multi",
		languages: "Langues",
		openInApp: "Ouvrir dans l’application",
	},
};
languages["en-UK"] = languages.en;
