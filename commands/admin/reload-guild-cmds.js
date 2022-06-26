"use strict";

const { commands, updateCmd } = require("../guild");

exports.description = "Reload guild commands of a guild";
exports.run = async inter => {
	const guild = inter.client.guilds.cache.get(inter.options.getString("params"));
	if(!guild)
		return inter.reply({ephemeral: true, content: "Guild not found"}).catch(error);

	const results = await Promise.allSettled([
		inter.deferReply({ephemeral: true}).catch(Function()),
		...Object.values(commands).map(command => updateCmd(command, guild, true))
	]);

	for(const {status, reason} of results)
		if(status === "rejected")
		{
			console.error(reason);
			inter.editReply({ephemeral: true, content: `An error occurred:\n${reason.message?.substring(0, 1900)}`}).catch(error);
			return;
		}

	inter.editReply({ephemeral: true, content: "Commands reloaded."}).catch(error);
};
