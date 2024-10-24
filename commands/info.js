
import { getDetails, isNSFW, steamAppLink, HTTPError } from "../steam_news/api.js";
import interpretAppidOption from "../interpretAppidOption.function.js";
import { stmts } from "../steam_news/db.js";
const { getCC } = stmts;
import importJSON from "../utils/importJSON.function.js";
const { langToCountry } = importJSON("locales.json");

export const dmPermission = true;
export const options = [{
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
		{ name: "Deutsch", value: "de" },
		{ name: "My own locale", value: "own" },
	],
}];
export { default as autocomplete } from "../autocomplete/search.js";
export async function run(inter)
{
	const { appid, defer } = await interpretAppidOption(inter);
	if(!appid)
		return;

	const langOpt = inter.options.getString("language");
	const lang = langOpt && langOpt !== "own" ? langOpt : (
		getCC(inter.guild?.id)?.toLowerCase() || inter.locale || "en"
	);
	const t = tr.set(lang, "info");

	getDetails(appid, lang, langToCountry[lang]).then(async details => {
		await defer;
		if(!details)
			return inter.editReply({ephemeral: true, content: t("invalidAppid")});

		const {
			type, fullgame,
			steam_appid, developers, website,
			name, header_image, release_date: {date = t("comingSoon")},
			genres = [], metacritic,
			platforms, categories,
			dlc, is_free, price_overview: price = {}, // is_free can be false and price_overview undefined if the game is not out yet
			supported_languages = "—",
		} = details;
		const nsfw = isNSFW(details);

		if(nsfw && !inter.channel.nsfw) // temporary
			return inter.editReply({ephemeral: true, content: t("nsfwForbidden")});

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
				{ name: t("price"), value: is_free && !price.discount_percent ? t("free")
					: "final_formatted" in price ? displayPrice(price)
					: t("undefined"), inline: true },
				{ name: t("DLC"), value: type === "dlc"
					? `${t("game")} ${fullgame.name} (${fullgame.appid})`
					: (dlc?.length || 0)+"", inline: true },
				{ name: t("platforms"), value: listPlatforms(platforms) || t("unknown"), inline: true },
				{ name: t("controllerSupport"), value: t(`controller_${controllerSupport(details)}`), inline: true },
				{ name: t("multi"), value: categories?.some(({id}) => id === 1) ? t("yes") : t("no"), inline: true },
				{ name: t("languages"), value: parseLanguages(supported_languages, 500) },
				{ name: t("openInApp"), value: steamAppLink(`store/${appid}`, lang) },
			],
			image: { url: header_image },
		}] });
	}, async err => {
		await defer;
		if(err instanceof TypeError && err.message.includes("appid"))
			inter.editReply({ephemeral: true, content: tr.get(inter.locale, "bad-appid")});
		else if(err instanceof HTTPError)
		{
			const { code } = err;
			inter.editReply({
				ephemeral: true,
				content: tr.get(inter.locale, code === 403 ? "api-403" : "api-err", code),
			});
		}
		else
		{
			error(err);
			inter.editReply({ephemeral: true, content: tr.get(inter.locale, "error")});
		}
	});
}


// Thanks Akane!
function controllerSupport({ controller_support, categories })
{
	if(controller_support === "full" || categories.some(({ id }) => id === 28))
		return "full";
	if(categories.some(({ id }) => id === 18))
		return "partial";
	return "no";
}


function displayPrice({discount_percent, final_formatted})
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

function parseLanguages(html, maxLength = 1024)
{
	html = html.replaceAll(/\*/g, "\\*")
		.replaceAll(/<br\/?>(.+)/g, "\n_$1_")
		.replaceAll(" - ", " – ") // non-breaking spaces
		.replaceAll(/<\/?(strong|b)>/g, "**")
		.replaceAll(/<\/?(em|i)>/g, "_");

	return html.length < maxLength ? html : `${html.substring(0, maxLength-1)}…`;
}
