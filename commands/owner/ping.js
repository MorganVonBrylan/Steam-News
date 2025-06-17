
export const description = "Pong!";
export async function run(inter)
{
	inter.reply({ flags: "Ephemeral", content: `Pong! (${inter.client.ws.ping}ms)` });
}
