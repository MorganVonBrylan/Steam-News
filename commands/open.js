"use strict";

const { search, steamAppLink } = require("../steam_news/api");

exports.dmPermission = true;
exports.autocomplete = require("../autocomplete/search");
exports.options = [{
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
exports.run = async inter => {
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
				return inter.reply({ephemeral: true, content: tr.get(inter.locale, "no-match", appid)}).catch(error);
		}
	}

	inter.reply({ephemeral: true, embeds: [{
		description: steamAppLink("steam://store/"+appid, inter.locale).replace("[", "[👉 "),
	}]}).catch(error);
}
