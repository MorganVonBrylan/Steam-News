"use strict";

const { checkForNews } = require("../../steam_news/watchers");

exports.description = "Forces checking the news";
exports.run = inter => checkForNews().then(n => inter.reply({ephemeral: true, content: `Sent ${n} news`}).catch(error));
