
import { guildCommands } from "@brylan/djs-commands";
const { commands, updateCmd } = guildCommands;

export const description = "Reload guild commands of a guild";
export const options = [{
	type: STRING, name: "guild",
	description: "The guild id. If not provided the current guild will be reloaded.",
}];
export async function run(inter)
{
	const guild = await inter.client.guilds
		.fetch(inter.options.getString("guild") || inter.guildId);
	if(!guild)
		return inter.reply({ephemeral: true, content: "Guild not found"});

	const results = await Promise.allSettled([
		inter.deferReply({ephemeral: true}).catch(Function()),
		...Object.values(commands).map(command => updateCmd(command, guild))
	]);

	for(const {status, reason} of results)
		if(status === "rejected")
		{
			console.error(reason);
			inter.editReply({ephemeral: true, content: `An error occurred:\n${reason.message?.substring(0, 1900)}`});
			return;
		}

	inter.editReply({ephemeral: true, content: "Commands reloaded."});
};
