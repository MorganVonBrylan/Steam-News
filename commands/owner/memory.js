
export const description = "Gets the amount of memory used.";
export function run(inter)
{
	inter.reply({ephemeral: true, content: `${Math.round(process.memoryUsage().rss / 1000)}k`});
}
