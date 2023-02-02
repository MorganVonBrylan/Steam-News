"use strict";

const { stmts: {isWatchingSteam, unwatchSteam} } = require("../../steam_news/db");

exports.shouldCreateFor = isWatchingSteam;
const deleteCmd = require(".").deleteCmd.bind(null, exports);

const localizations = require("./_localizationHelper")("steam-unwatch");

exports.defaultMemberPermissions = "0";
exports.nameLocalizations = localizations.get("name");
exports.description = tr.cmdDescription("steam-unwatch");
exports.descriptionLocalizations = localizations.get("description");
exports.getOptions = () => [];

exports.run = async inter => {
	const unwatched = unwatchSteam(inter.guild.id);
	inter.reply({ ephemeral: true, content: tr.get(inter.locale, `steam.unwatched`) }).catch(error);
	deleteCmd(inter.guild);
}
