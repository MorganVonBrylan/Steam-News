"use strict";

const { search } = require("./steam_news/api");

module.exports = exports = async function interpretAppid(inter, ephemeral = false, optionName = "game")
{
	const defer = inter.deferReply({ephemeral}).catch(error);
	const appid = inter.options.getString(optionName);
	if(isFinite(appid))
		return { appid, defer };

	const [game] = await search(appid);
	if(game)
		return { appid: game.id, defer };

	defer.then(() => inter.editReply({ephemeral: true, content: tr.get(inter.locale, "no-match", appid)}).catch(error));

	return { defer };
}
