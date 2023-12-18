"use strict";

const { sendToMaster } = require("./bot");
const { DiscordAPIError } = require("discord.js");

const recent = new Set();

global.error = module.exports = exports = function error(err)
{
	let msg = "An error occurred; read the console for details.";

	if(err?.message)
	{
		const {message} = err;
		const status = err.httpStatus || err.response?.status || err.response?.statusCode;
		const code = err.code || err.cause?.code;
		if(message === "read ECONNRESET"
			|| status === 403 || status === 404 || status === 408 || status >= 500
			|| message === "Unknown interaction" || message === "Missing Access"
			|| message.startsWith("invalid json response body")
			|| code === "UND_ERR_CONNECT_TIMEOUT"
			|| code === "UND_ERR_ABORTED")
			return;

		msg += err instanceof DiscordAPIError
			? `\nMessage : ${message}\nPath : ${err.path}`
			: `\nMessage : ${message}`;
	}

	if(!recent.has(msg))
	{
		sendToMaster(msg, console.error);
		recent.add(msg);
		setTimeout(recent.delete.bind(recent, msg), 3600_000);
	}
	console.error(err);
}
