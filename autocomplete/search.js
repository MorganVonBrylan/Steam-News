"use strict";

const { search } = require("../steam_news/api");

module.exports = exports = inter => {
	search(inter.options.getFocused()).then(results => {
		inter.respond(results.map(({id, name}) => ({ name: name.length > 100 ? name.substring(0, 99) + "…" : name, value: ""+id }))).catch(error);
	})
}
