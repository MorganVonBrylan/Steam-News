import { writeHeapSnapshot } from "node:v8";

export const description = "Writes a memory snapshot. Warning: temporarily doubles memory usage.";
export async function run(inter)
{
	await inter.deferReply({ephemeral: true});
	const file = writeHeapSnapshot();
	inter.editReply(`${file} was created.`);
}
