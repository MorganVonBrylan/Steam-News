"use strict";

exports.dmPermission = true;
exports.description = "Pong!";
exports.run = async inter => {
	inter.reply({ephemeral: true, content: `Pong! (${inter.client.ws.ping}ms)`});
}
