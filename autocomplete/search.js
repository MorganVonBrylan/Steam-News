
import { search } from "../steam_news/api.js";

const resultToOption = ({ id, name }) => ({
	name: name.length > 100 ? name.substring(0, 99) + "…" : name,
	value: "" + id,
});

export default all;
export function all(inter)
{
	search(inter.options.getFocused()).then(results => {
		inter.respond(results.map(resultToOption));
	});
}

export function appsOnly(inter)
{
	search(inter.options.getFocused()).then(results => {
		inter.respond(results.filter(({type}) => type === "app").map(resultToOption));
	});
}
