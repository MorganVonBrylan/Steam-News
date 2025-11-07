
import { search } from "../steam_news/api.js";

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


function toString() {
	return this.name;
}
export function formatOptionName(name) {
	return name.length > 32 ? name.substring(0, 31) + "…" : name;
}
export function gameToOption({ name, appid }) {
	return { name: formatOptionName(name), value: ""+appid, toString };
}