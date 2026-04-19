
import { Buffer } from "node:buffer";

export default fetchImage;

/**
 * Get a remove image as base64.
 * @param {string} url The image URL
 * @returns {Promise<`data:image/${string};base64,${string}`>} base64 representation of the image
 * 
 * @throws {TypeError} If the request fails
 * @throws {Response} if the request didn't end with a 2xx code
 * @throws {TypeError & { contentType: string }} If the response does not contain an image
 */
export async function fetchImage(url)
{
	const res = await fetch(url);
	if(!res.ok)
		throw res;
	const contentType = res.headers.get("content-type");
	if(!contentType?.startsWith("image/"))
		throw Object.assign(new TypeError(`Wrong MIME type`), {contentType})
	const data = Buffer.from(await res.arrayBuffer());
	return `data:${contentType};base64,${data.toString("base64")}`;
}