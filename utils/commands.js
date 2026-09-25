
import { search, HTTPError, ApiError } from "../steam_news/api.js";
import { getLocale } from "../steam_news/db_api.js";
import locales from "../localization/locales.js";
const { languageCodes } = locales;

export { mentionCommand as mention } from "@brylan/djs-commands";

/** @import {ChatInputCommandInteraction} from "discord.js" */

/**
 * Defers an interaction and returns the defer promise and app id.
 * If the option is not an appid, a search will be made on the Steam API; if it fails, it replies to the interaction with an error and won't include the app id in the return value.
 * @param {ChatInputCommandInteraction} inter the interaction
 * @param {boolean} ephemeral Whether to make the defer ephemeral
 * @param {string} optionName The name of the appid option
 * @returns {Promise<{appid: ?string, defer: Promise}>}
 */
export async function interpretAppidOption(inter, ephemeral = false, optionName = "game")
{
	const defer = inter.deferReply(ephemeral ? { flags: "Ephemeral" } : {});
	defer.catch(error);
	const appid = inter.options.getString(optionName);
	if(isFinite(appid))
		return { appid, defer };

	try {
		const [game] = await search(appid);
		if(game)
			return { appid: game.id, defer };

		defer.then(() => inter.editReply({flags: "Ephemeral", content: tr.get(inter.locale, "no-match", appid)}));
	} catch {
		defer.then(() => inter.editReply({flags: "Ephemeral", content: tr.get(inter.locale, "api-failed")}));
	}
	return { defer };
}


/**
 * Determines what language to use for a command interaction.
 * The priority is, in order:
 * 1. The language option, if any
 * 2. If in a server:
 * 2.a. The set language for this server (with /locale)
 * 2.b. If a community server, the preferredLocale
 * 3. The interaction's locale
 * @param {ChatInputCommandInteraction} inter the interaction
 * @param {string} [languageOption] A language option the command has, if any.
 * @returns {string} A language code (e.g fr, en-US, etc)
 */
export function determineLanguage(inter, languageOption)
{
	if(languageOption)
	{
		const langOption = inter.options.getString(languageOption);
		if(langOption) return langOption;
	}
	if(inter.guildId)
	{
		const { guildId, guild } = inter;
		const locale = getLocale(guildId);
		if(locale) return languageCodes[locale.lang];
		if(guild?.features.includes("COMMUNITY")) return guild.preferredLocale;
	}
	return inter.locale;
}


function toString() {
	return this.name;
}
export function formatOptionName(name) {
	return name.length > 32 ? name.substring(0, 31) + "…" : name;
}
export function gameToOption({ name, appid }) {
	return { name: formatOptionName(name), value: appid, toString };
}
export function groupToOption({ name, clanid }) {
	return { name: formatOptionName(name), value: clanid, toString };
}

/**
 * Handle any generic mishap with an API call, editing the reply of the interaction accordingly.
 * @param {Error} err The error
 * @param {ChatInputCommandInteraction} inter The interaction
 * @param {object} [additionalInfo] Additional info to provide in case the error needs to be logged.
 */
export function handleGenericApiError(err, inter, additionalInfo)
{
	const { locale } = inter;
	if(err instanceof TypeError && err.message.includes("appid"))
		inter.editReply(tr.get(locale, "bad-appid"));
	else if(err instanceof HTTPError)
	{
		const { code } = err;
		const key = code === 403 ? "api-403" : "api-err";
		inter.editReply(tr.get(locale, key, code));
	}
	else if(err instanceof ApiError)
		inter.editReply(tr.get(locale, "api-failed"));
	else
	{
		if(additionalInfo) Object.assign(err, additionalInfo);
		error(err);
		inter.editReply(tr.get(locale, "error"));
	}
}