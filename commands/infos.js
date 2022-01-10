"use strict";

const { getDetails, isNSFW } = require("../steam_news/api");

exports.description = "Affiche les infos sur un jeu";
exports.options = [{
	type: "INTEGER", name: "id",
	description: "L'id du jeu", required: true
}];
exports.run = inter => {
	const defer = inter.deferReply().catch(error);
	getDetails(inter.options.getInteger("id")).then(async details => {
		if(!details)
			return inter.reply({content: "Cet id ne correspond à aucun jeu Steam.", ephemeral: true}).catch(error);

		await defer;

		const {
			steam_appid, developers, website,
			name, header_image, release_date: {date = "*à venir*"},
			genres, metacritic,
			controller_support, platforms, categories,
			dlc, is_free, price_overview: price,
			supported_languages,
		} = details;
		const nsfw = isNSFW(details);

		if(nsfw && !inter.channel.nsfw)
			return inter.editReply({content: "Ce jeu a du contenu adulte. Vous ne pouvez afficher ses infos que dans un salon NSFW.", ephemeral: true}).catch(error);

		inter.editReply({ embeds: [{
			url: "https://store.steampowered.com/app/"+steam_appid,
			title: name,
			author: { name: developers.join(", "), url: website },
			image: { url: header_image },
			fields: [
				{ name: genres.length > 1 ? "Genres" : "Genre", value: genres.length ? genres.map(g => g.description).join(", ") : "*aucun*", inline: true },
				{ name: "Score Metacritic", value: metacritic ? `[${metacritic.score}](${metacritic.url})` : "*Inconnu*", inline: true },
				{ name: "NSFW", value: nsfw ? "🔞 Oui" : "Non", inline: true },
				{ name: "Date de publication", value: date, inline: true },
				{ name: "Prix", value: is_free ? "Gratuit" : price.final_formatted, inline: true },
				{ name: "DLCs", value: (dlc?.length || 0)+"", inline: true },
				{ name: "Plateformes", value: listPlatforms(platforms), inline: true },
				{ name: "Support manette", value: controller_support === "full" ? "Oui" : "Non", inline: true },
				{ name: "Multi", value: categories.some(({id}) => id === 1) ? "Oui" : "Non", inline: true },
				{ name: "Langues", value: parseLanguages(supported_languages) },
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
