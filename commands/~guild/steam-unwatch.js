
import { stmts } from "../../steam_news/db.js";
import { STEAM_APPID } from "../../steam_news/api.js";
const { getSteamWatcher, unwatchSteam, isSteamWatched, updateLatest } = stmts;

import { guildCommands } from "@brylan/djs-commands";

export { getSteamWatcher as shouldCreateFor };
const deleteCmd = guildCommands.deleteCmd.bind(null, "steam-unwatch");

export const defaultMemberPermissions = "0";
/** @param {import("discord.js").ChatInputCommandInteraction} inter */
export async function run(inter)
{
	unwatchSteam(inter.guildId);
	inter.reply({ flags: "Ephemeral", content: tr.get(inter.locale, "steam.unwatched") });
	deleteCmd(inter.guild);
	if(!isSteamWatched())
		updateLatest({ appid: STEAM_APPID, latest: null });
}
