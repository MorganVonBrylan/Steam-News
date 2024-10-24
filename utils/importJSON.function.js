
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cache = new Map();

/**
 * Import a JSON file like require, except relative paths are relative to the working directory instead of the current file.
 * @param {string} path The .json file's path
 * @returns {*} The parsed JSON file
 */
export default function importJSON(path)
{
    path = resolve(path);
    if(cache.has(path))
        return cache.get(path);

    const json = JSON.parse(readFileSync(path));
    cache.set(path, json);
    return json;
}
