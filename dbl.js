"use strict";

module.exports = exports = (dblToken, client) => {
	if(!dblToken)
		return null;

	process.on("uncaughtException", error); // Node process
	const autoPoster = exports.autoPoster = new (require("topgg-autoposter").DJSPoster)(dblToken, client);
	autoPoster.on("error", error);
	return autoPoster;
}
