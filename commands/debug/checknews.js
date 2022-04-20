"use strict";

const { checkForNews } = require("../../steam_news/watchers");

exports.description = "Force la vérification des actus";
exports.run = inter => checkForNews().then(n => inter.reply({ephemeral: true, content: `Envoyé ${n} actu(s)`}).catch(error));
