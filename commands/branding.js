
import { interpretAppidOption } from "../utils/commands.js";
import {
	getBasicDetails, HTTPError,
	banner as getBanner, getOfficialIcon, getUnofficialIcon,
} from "../steam_news/api.js";
import { getAppName } from "../steam_news/db_api.js";

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export const options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
export { default as autocomplete } from "../autocomplete/search.js";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	const { appid, defer } = await interpretAppidOption(inter);
	if(!appid)
		return;

	await defer;
	const { locale } = inter;
	const details = await getBasicDetails(appid).catch(err => {
		if(err instanceof TypeError && err.message.includes("appid"))
			inter.editReply(tr.get(locale, "bad-appid"));
		else if(err instanceof HTTPError)
		{
			const { code } = err;
			inter.editReply(tr.get(locale, code === 403 ? "api-403" : "api-err", code));
		}
		else
		{
			error(err);
			inter.editReply({flags: "Ephemeral", content: tr.get(locale, "error")});
		}
		return null;
	});
	if(!details)
		return;

	const {
		type, name, fullgame,
		[getBanner.LARGE]: header,
		[getBanner.MEDIUM]: capsule,
	} = details;
	const banner = header || capsule;

	const t = tr.set(locale, "branding");
	const [icon, sgdbIcon] = type !== "game" ? [] : (await Promise.allSettled([
		getOfficialIcon(appid),
		getUnofficialIcon(appid),
	])).map(({value, reason}) => {
		if(value) return value;
		console.warn("/branding error for app", appid, reason);
		return null;
	});
	
	const embeds = banner || icon ? [{
		title: t("official", name),
		description: fullgame && t("dlc", fullgame.name),
		thumbnail: { url: icon },
		image: { url: banner },
	}] : [{
		title: t("official"),
		description: t("official-fail"),
	}];

	if(capsule && banner === header)
		embeds.push({image: {url: capsule}});

	if(sgdbIcon)
		embeds.push({title: t("sgdb"), image: {url: sgdbIcon}, footer: {text: t("sgdb-explain")}});

	inter.editReply({ embeds });
}

