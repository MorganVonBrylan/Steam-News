"use strict";

exports.description = "KILLS THE BOT — KILL IT, KILL IT! IT'S GOTTEN ROGUE!";
exports.run = inter => inter.reply({content: "seeya", ephemeral: true}).catch(Function()).finally(() => {
	require("../../bot").client.destroy();
	process.exit();
});
