"use strict";

const { search } = require("../steam_news/api");

const resultToOption = ({ id, name }) => ({
	name: name.length > 100 ? name.substring(0, 99) + "…" : name,
	value: "" + id,
});

module.exports = exports = inter => {
	search(inter.options.getFocused()).then(results => {
		inter.respond(results.map(resultToOption));
	});
}

exports.appsOnly = inter => {
	search(inter.options.getFocused()).then(results => {
		inter.respond(results.filter(({type}) => type === "app").map(resultToOption));
	});
}
