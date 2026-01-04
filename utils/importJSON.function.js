
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const cache = new Map();

/**
 * Import a JSON file like require, except relative paths are relative to the working directory instead of the current file.
 * @param {string} path The .json file's path
 * @param {*} defaultValue The default value to use in case the file doesn't exist. If left undefined, the function will throw instead.
 * @returns {*} The parsed JSON file
 */
export default function importJSON(path, defaultValue)
{
	path = resolve(path);
	if(cache.has(path))
		return cache.get(path);

	let value;
	if(existsSync(path))
		value = JSON.parse(readFileSync(path));
	else
	{
		if(defaultValue !== undefined)
			value = defaultValue;
		else
			throw new Error(`The file '${path}' does not exist.`);
	}

	cache.set(path, value);
	return value;
}
