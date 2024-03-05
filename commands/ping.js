
export const dmPermission = true;
export const description = "Pong!";
export async function run(inter)
{
	inter.reply({ ephemeral: true, content: `Pong! (${inter.client.ws.ping}ms)` });
}
