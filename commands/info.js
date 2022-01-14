"use strict";

const { getDetails, isNSFW } = require("../steam_news/api");

exports.description = "See info about a game (genre, price, release date, etc)";
exports.options = [{
	type: "INTEGER", name: "id",
	description: "The game’s id", required: true
}, {
	type: "STRING", name: "language",
	description: "The language to display info in",
	choices: [
		{ name: "English (default)", value: "en" },
		{ name: "Français", value: "fr" },
	],
}];
exports.run = inter => {
	const lang = inter.options.getString("language") || "en";
	const tr = languages[lang];
	const defer = inter.deferReply().catch(error);
	getDetails(inter.options.getInteger("id"), lang).then(async details => {
		if(!details)
			return inter.reply({content: tr.invalidAppid, ephemeral: true}).catch(error);

		await defer;

		const {
			type, fullgame,
			steam_appid, developers, website,
			name, header_image, release_date: {date = tr.comingSoon},
			genres, metacritic,
			controller_support, platforms, categories,
			dlc, is_free, price_overview: price,
			supported_languages,
		} = details;
		const nsfw = isNSFW(details);

		if(nsfw && !inter.channel.nsfw)
			return inter.editReply({content: tr.nsfwForbidden, ephemeral: true}).catch(error);

		inter.editReply({ embeds: [{
			url: "https://store.steampowered.com/app/"+steam_appid,
			title: name,
			author: { name: developers.join(", "), url: website },
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
				{ name: tr.platforms, value: listPlatforms(platforms), inline: true },
				{ name: tr.controllerSupport, value: controller_support === "full" ? tr.yes : tr.no, inline: true },
				{ name: tr.multi, value: categories.some(({id}) => id === 1) ? tr.yes : tr.no, inline: true },
				{ name: tr.languages, value: parseLanguages(supported_languages) },
			],
			description: details.short_description,
		}] }).catch(error);
	})
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