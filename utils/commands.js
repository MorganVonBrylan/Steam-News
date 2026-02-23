
import { search } from "../steam_news/api.js";
import { ApplicationCommand, ChatInputCommandInteraction } from "discord.js";

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
 * Format a command or interaction into a command mention.
 * @param {ApplicationCommand|ChatInputCommandInteraction} cmdOrInter An application command or a command interaction
 * @returns {`</${string}:${string}>`} a command mention
 */
export function mention(cmdOrInter)
{
	if(cmdOrInter instanceof ApplicationCommand)
		return `</${cmdOrInter.name}:${cmdOrInter.id}`;
	else
	{
		const { options, commandName, commandId } = cmdOrInter;
		let fullName = commandName;
		const group = options.getSubcommandGroup(false);
		if(group)
			fullName += ` ${group}`;
		const subCommand = options.getSubcommand(false);
		if(subCommand)
			fullName += ` ${subCommand}`;

		return `</${fullName}:${commandId}>`;
	}
}

function toString() {
	return this.name;
}
export function formatOptionName(name) {
	return name.length > 32 ? name.substring(0, 31) + "…" : name;
}
export function gameToOption({ name, appid }) {
	return { name: formatOptionName(name), value: ""+appid, toString };
}