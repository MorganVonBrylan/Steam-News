
import strings from "./data/en.json" with { type: "json" };

console.log(count(strings, "strings"));

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
