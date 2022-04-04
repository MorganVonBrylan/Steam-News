"use strict";

const { search } = require("../steam_news/api");

exports.global = true;
exports.autocomplete = require("../autocomplete/search");
exports.description = "Get a link to open a game in the Steam app";
exports.options = [{
	type: "STRING", name: "name", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}];
exports.run = async inter => {
	let appid = inter.options.getString("name");

	if(!isFinite(appid))
	{
		const [game] = await search(appid);
		if(game)
			appid = game.id;
		else
			return defer.then(() => inter.reply({ content: `No game matching "${appid}" found.`, ephemeral: true }).catch(error));
	}

	inter.reply({embeds: [{title: "steam://store/"+appid}], ephemeral: true}).catch(error);
}
