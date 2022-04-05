"use strict";

exports.description = "Explains every admin command";

const fields = require("fs").readdirSync(__dirname).map(f => f.substring(0, f.length-3))
	.map(cmd => {
		const {description} = require("./"+cmd);
		return {name: cmd, value: description};
	});

exports.run = inter => inter.reply({embeds: [{ fields }], ephemeral: true}).catch(error);
