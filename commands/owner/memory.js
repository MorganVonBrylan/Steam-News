"use strict";

exports.description = "Gets the amount of memory used.";
exports.run = inter => {
	inter.reply({ephemeral: true, content: `${Math.round(process.memoryUsage().rss / 1000)}k`}).catch(error);
};
