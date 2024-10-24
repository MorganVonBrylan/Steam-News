
// In Node >=21, can be replaced with import.meta.dirname

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns the current directory
 * @param {string} metaUrl import.meta.url
 */
export const __dirname = metaUrl => dirname(fileURLToPath(metaUrl));
export default __dirname;