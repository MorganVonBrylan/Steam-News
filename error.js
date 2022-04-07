"use strict";

const {sendToMaster} = require("./bot");

global.error = module.exports = exports = function error(err)
{
	let msg = "Une erreur est survenue ; lisez la console pour plus de détails.";

	if(err && err.message)
	{
		const {message} = err;
		const status = err.httpStatus || err.response?.status;
		if(message === "read ECONNRESET" || status === 403 || status === 404 || status === 408 || status >= 500)
			return;

		msg += err.name === "DiscordAPIError" ? `\nMessage : ${message}\nChemin : ${err.path}` : `\nMessage : ${message}`;
	}

	sendToMaster(msg, console.error);
	console.error(err);
}
