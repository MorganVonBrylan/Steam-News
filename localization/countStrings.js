
import importJSON from "../utils/importJSON.function.js";

console.log(count(importJSON(import.meta.dirname+"/en.json")), "strings");

function count(group)
{
	let strings = 0;
	for(const entry of Object.values(group))
	{
		if(typeof entry === "string")
			strings++;
		else
			strings += count(entry);
	}

	return strings;
}
