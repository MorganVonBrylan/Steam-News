
import { getGroupDetails, steamAppLink, HTTPError } from "../steam_news/api.js";
import { getLocale } from "../steam_news/db_api.js";
import locales from "../localization/locales.js";
const { steamLanguages, languageCodes } = locales;
import { toMarkdown } from "../steam_news/toEmbed.function.js";

const URL_REGEXES = [
	/^https:\/\/store.steampowered.com\/curator\/([0-9]+)/,
	/^https:\/\/store.steampowered.com\/news\/group\/([0-9]+)/,
	/^https:\/\/steamcommunity.com\/groups\/([^/]+)/,
];

export function getNameOrId(nameIdOrURL)
{
	if(nameIdOrURL.startsWith("https://")) for(const regex of URL_REGEXES)
	{
		const match = nameIdOrURL.match(regex);
		if(match)
		{
			nameIdOrURL = match[1];
			break;
		}
	}
	
	return nameIdOrURL.match(/^[0-9]+$/) ? +nameIdOrURL : nameIdOrURL;
}

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export const options = [{
	type: STRING, name: "group", required: true,
	description: "The group’s name or URL",
}];
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const defer = inter.deferReply();
	const guildLocale = inter.guild && (getLocale(inter.guildId) || inter.guild.preferredLocale);
	const lang = guildLocale?.lang || steamLanguages[inter.locale];
	const t = tr.set(languageCodes[lang], "group");

	getGroupDetails(getNameOrId(inter.options.getString("group")), lang)
	.then(async details => {
		await defer;
		if(!details)
		{
			const delay = 20;
			inter.editReply({flags: "Ephemeral", content: t("invalidGroup", delay)});
			setTimeout(() => inter.deleteReply(), delay * 1000);
			return;
		}

		const {
			id, group_name, vanity_url,
			avatar_medium_url,
			description, curator_descs,
			member_count, followers,
			is_curator, weblink,
		} = details;

		const fields = [
			{ name: t("members"), value: member_count, inline: true },
			{ name: t("followers"), value: followers, inline: true },
		];
		if(is_curator)
			fields.push({ name: t("curator_desc"), value: curator_descs[lang] });

		fields.push({ name: t("openInApp"), value: steamAppLink(`url/GroupSteamIDPage/${id}`, lang) });

		inter.editReply({ embeds: [{
			url: "https://steamcommunity.com/groups/"+vanity_url,
			thumbnail: { url: avatar_medium_url },
			author: weblink && { name: weblink.title, url: weblink.url },
			title: group_name,
			provider: { name: "Steam", url: "https://steamcommunity.com/" },
			description: toMarkdown(description),
			fields,
		}] });
	}, async err => {
		await defer;
		if(err instanceof HTTPError)
		{
			const { code } = err;
			inter.editReply({
				flags: "Ephemeral",
				content: tr.get(inter.locale, code === 403 ? "api-403" : "api-err", code),
			});
		}
		else
		{
			error(err);
			inter.editReply({flags: "Ephemeral", content: tr.get(inter.locale, "error")});
		}
	});
}


// Thanks Akane!
function controllerSupport({ controller_support, categories = [] })
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
