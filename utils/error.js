
global.error = error;
process.on("unhandledRejection", error);

import { sendToMaster } from "../bot.js";
import { DiscordAPIError } from "discord.js";
import TopGGAPIError_ from "@top-gg/sdk/dist/utils/ApiError.js";
const TopGGAPIError = TopGGAPIError_.default;


const recent = new Set();

export default error;
export function error(err)
{
	if(err instanceof SyntaxError) // from an import probably
		throw err;
	
	if(
		err instanceof DOMException // Discord.js failing some random call
		|| err instanceof TopGGAPIError && err.response.statusCode === 429 // occasional Top.gg bug
	)
		return;
	
	let msg = "An error occurred; read the console for details.";

	if(err?.message)
	{
		const {message} = err;
		const status = err.httpStatus || err.response?.status
					 || err.response?.statusCode || err.code;
		const code = err.code || err.cause?.code;
		if(message === "read ECONNRESET"
			|| status === 403 || status === 404 || status === 408 || status >= 500
			|| message === "Unknown interaction" || message === "Missing Access"
			|| message.startsWith("invalid json response body")
			|| code === "UND_ERR_CONNECT_TIMEOUT"
			|| code === "UND_ERR_ABORTED"
			|| code === "UND_ERR_SOCKET")
			return;

		if(err instanceof DiscordAPIError)
		{
			msg += `\nMessage : ${message}\nPath : ${err.path || err.url}`;
			console.log("data:", err.requestBody?.json?.data);
		}
		else
			msg += `\nMessage : ${message}`;
	}

	if(!recent.has(msg))
	{
		sendToMaster(msg, console.error);
		recent.add(msg);
		setTimeout(recent.delete.bind(recent, msg), 3600_000);
	}
	console.error(err);
}
