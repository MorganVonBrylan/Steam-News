
import { stmts } from "../../steam_news/db.js";
const { getSteamWatcher, unwatchSteam } = stmts;

import { guildCommands } from "@brylan/djs-commands";

export { getSteamWatcher as shouldCreateFor };
const deleteCmd = guildCommands.deleteCmd.bind(null, "steam-unwatch");

export const defaultMemberPermissions = "0";
export async function run(inter)
{
	unwatchSteam(inter.guildId);
	inter.reply({ ephemeral: true, content: tr.get(inter.locale, "steam.unwatched") });
	deleteCmd(await inter.fetchGuild());
}
