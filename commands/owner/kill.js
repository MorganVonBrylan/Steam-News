
import { client } from "../../bot.js";

export const description = "KILLS THE BOT — KILL IT, KILL IT! IT'S GOTTEN ROGUE!";
export function run(inter)
{
	return inter.reply({ flags: "Ephemeral", content: "seeya" })
		.catch(Function.noop)
		.finally(async () => {
			client.destroy();
			process.exit();
		});
}
