"use strict";

const db = require("../steam_news/db");
const { stmts: { watchSteam } } = db;

const createCmd = require("@brylan/djs-commands").guildCommands.createCmd.bind(null, require("./#guild/steam-unwatch"));

exports.defaultMemberPermissions = "0";
exports.options = [{
	type: ROLE, name: "role",
	description: "A role to ping when news are posted",
}, {
	type: CHANNEL, name: "channel",
	channelTypes: ALL_TEXT_CHANNEL_TYPES,
	description: "The channel where to send the news (defaults to current channel if not provided)"
}];
exports.run = async inter => {
	const channel = inter.options.getChannel("channel") || inter.channel;
	watchSteam({
		guildId: inter.guild.id,
		channelId: channel.id,
		roleId: inter.options.getRole("role")?.id,
	});
	inter.reply(tr.get(inter.locale, "steam.watched", channel));
	createCmd(inter.guild, true);
}
