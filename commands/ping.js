
export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export const description = "Pong!";
export async function run(inter)
{
	inter.reply({ flags: "Ephemeral", content: `Pong! (${inter.client.ws.ping}ms)` });
}
