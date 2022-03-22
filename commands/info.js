"use strict";

const { search, getDetails, isNSFW } = require("../steam_news/api");

exports.global = true;
exports.description = "See info about a game (genre, price, release date, etc)";
exports.options = [{
	type: "STRING", name: "name", required: true,
	description: "The game’s name or id",
}, {
	type: "STRING", name: "language",
	description: "The language to display info in",
	choices: [
		{ name: "English (price in US$)", value: "en" },
		{ name: "English (price in pounds)", value: "en-UK" },
		{ name: "Français", value: "fr" },
	],
}];
exports.run = async inter => {
	const lang = inter.options.getString("language") || "en";
	const tr = languages[lang];
	const defer = inter.deferReply().catch(error);
	let appid = inter.options.getString("name");

	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return defer.then(() => inter.editReply({ content: `No game matching "${appid}" found.`, ephemeral: true }).catch(error));
	}

	getDetails(appid, lang, cc[lang]).then(async details => {
		await defer;
		if(!details)
			return inter.editReply({content: tr.invalidAppid, ephemeral: true}).catch(error);

		const {
			type, fullgame,
			steam_appid, developers, website,
			name, header_image, release_date: {date = tr.comingSoon},
			genres = [], metacritic,
			controller_support, platforms, categories,
			dlc, is_free, price_overview: price = {}, // temporary fix
			supported_languages,
		} = details;
		const nsfw = isNSFW(details);

		if(nsfw && !inter.channel.nsfw) // temporary
			return inter.editReply({content: tr.nsfwForbidden, ephemeral: true}).catch(error);

		if(!is_free && !price)
			error(new Error(`Weird thing about app ${appid} (${name}): is_free is false but price_overview is undefined`));

		inter.editReply({ embeds: [{
			url: "https://store.steampowered.com/app/"+steam_appid,
			title: name,
			author: developers ? { name: developers.join(", "), url: website } : null,
			provider: { name: "Steam", url: "https://store.steampowered.com/" },
			image: { url: header_image },
			fields: [
				{ name: genres.length > 1 ? tr.genres : tr.genre, value: genres.length ? genres.map(g => g.description).join(", ") : tr.none, inline: true },
				{ name: tr.metacritic, value: metacritic ? `[${metacritic.score}](${metacritic.url})` : tr.unknown, inline: true },
				{ name: tr.nsfw, value: nsfw ? `🔞 ${tr.yes}` : tr.no, inline: true },
				{ name: tr.releaseDate, value: date, inline: true },
				{ name: tr.price, value: is_free ? tr.free : price.final_formatted, inline: true },
				{ name: tr.DLC, value: type === "dlc"
					? `${tr.game} ${fullgame.name} (${fullgame.appid})`
					: (dlc?.length || 0)+"", inline: true },
				{ name: tr.platforms, value: platforms?.length ? listPlatforms(platforms) : tr.unknown, inline: true },
				{ name: tr.controllerSupport, value: controller_support === "full" ? tr.yes : tr.no, inline: true },
				{ name: tr.multi, value: categories.some(({id}) => id === 1) ? tr.yes : tr.no, inline: true },
				{ name: tr.languages, value: parseLanguages(supported_languages) },
			],
			description: details.short_description,
		}] }).catch(error);
	}).catch(err => console.error(`appid: ${appid}`, err));
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


const cc = { fr: "FR", en: "US", "en-UK": "UK" };

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
	},
};
languages["en-UK"] = languages.en;
