"use strict";

const { checkForNews } = require("../../steam_news/watchers");

exports.description = "Force la vérification des actus";
exports.run = inter => checkForNews().then(n => inter.reply({content: `Envoyé ${n} actu(s)`, ephemeral: true}).catch(error));
