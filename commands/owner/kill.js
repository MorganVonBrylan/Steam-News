"use strict";

exports.description = "KILLS THE BOT — KILL IT, KILL IT! IT'S GOTTEN ROGUE!";
exports.run = inter => inter.reply({ephemeral: true, content: "seeya"}).catch(Function()).finally(() => {
	require("../../bot").client.destroy();
	process.exit();
});
