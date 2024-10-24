
import importJSON from "../utils/importJSON.function.js";
import __dirname from "../utils/__dirname.js";
console.log(count(importJSON(__dirname(import.meta.url)+"/en.json")), "strings");

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
