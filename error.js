
global.error = error;
process.on("unhandledRejection", error);

import { sendToMaster } from "./bot.js";
import { DiscordAPIError } from "discord.js";

const recent = new Set();

export default error;
export function error(err)
{
	if(err instanceof SyntaxError) // from an import probably
		throw err;
	
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
			|| code === "UND_ERR_ABORTED")
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
