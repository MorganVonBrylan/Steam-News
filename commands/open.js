
import { search, steamAppLink } from "../steam_news/api.js";

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
	let appid = inter.options.getString("game");

	if(!isFinite(appid))
	{
		const matches = appid.match(/https:\/\/store.steampowered.com\/app\/([0-9]+)(\/?.*)/);
		if(matches)
			appid = matches[1];
		else
		{
			const [game] = await search(appid);
			if(game)
				appid = game.id;
			else
				return inter.reply({flags: "Ephemeral", content: tr.get(inter.locale, "no-match", appid)});
		}
	}

	const description = steamAppLink("store/"+appid, inter.locale).replace("[", "[👉 ");
	inter.reply({flags: "Ephemeral", embeds: [{ description }]});
}
