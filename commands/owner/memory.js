
export const description = "Gets the amount of memory used.";
export function run(inter)
{
	inter.reply({flags: "Ephemeral", content: `${Math.round(process.memoryUsage().rss / 1000)}k`});
}
