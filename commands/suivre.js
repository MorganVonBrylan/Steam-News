"use strict";

const { getDetails } = require("../steam_news/api");
const { watch, WATCH_LIMIT } = require("../steam_news/watchers");

exports.adminOnly = true;
exports.description = `(admins seulement) Suivre les actus d'un jeu (${WATCH_LIMIT} jeux par serveur maximum)`;
exports.options = [{
	type: "INTEGER", name: "id",
	description: "L'id du jeu", required: true
}, {
	type: "CHANNEL", name: "salon",
	description: "Le salon où envoyer les actualités", required: true
}];
exports.run = inter => {
	const channel = inter.options.getChannel("salon");
	if(!channel.isText())
		return inter.reply({ content: "Vous devez indiquer un salon textuel.", ephemeral: true }).catch(error);

	const defer = inter.deferReply({ephemeral: true}).catch(error);
	const appid = inter.options.getInteger("id");
	let details = getDetails(appid);
	watch(appid, channel).then(async success => {
		await defer;
		details = await details;
		inter.editReply({ content:
			success ? `Les actus de ${details.name} seront désormais envoyées dans ${channel}.${success === WATCH_LIMIT ? `\nAttention : vous êtes désormais à la limite de ${WATCH_LIMIT} jeux suivis par serveur.` : ""}`
				: `${details.name} était déjà suivi dans ce salon.`,
			ephemeral: true
		}).catch(error);
	}, async err => {
		await defer;
		if(err.message.includes("appid"))
			inter.editReply({ content: "Cet id ne correspond à aucun jeu Steam.", ephemeral: true }).catch(error);
		else if(err instanceof RangeError)
			inter.editReply({ content: `Erreur : Nombre maximum de jeux suivis par serveur atteint (${WATCH_LIMIT}).`, ephemeral: true }).catch(error);
		else
		{
			error(err);
			inter.editReply({ content: "Une erreur est survenue.", ephemeral: true }).catch(error);
		}
	});
}
