"use strict";

const { stmts: {isWatchingSteam, unwatchSteam} } = require("../../steam_news/db");

exports.shouldCreateFor = isWatchingSteam;
const deleteCmd = require("@brylan/djs-commands/guildCommands").deleteCmd.bind(null, exports);

const localizations = require("./#localizationHelper")("steam-unwatch");

exports.defaultMemberPermissions = "0";
exports.run = async inter => {
	const unwatched = unwatchSteam(inter.guild.id);
	inter.reply({ ephemeral: true, content: tr.get(inter.locale, `steam.unwatched`) }).catch(error);
	deleteCmd(inter.guild);
}
