"use strict";

const { getDetails } = require("../steam_news/api");
const { watch } = require("../steam_news/watchers");

exports.description = "Suivre les actus d'un jeu";
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
			success ? `Les actus de ${details.name} seront désormais envoyées dans ${channel}.`
				: `${details.name} était déjà suivi dans ce salon.`,
			ephemeral: true
		}).catch(error);
	}, err => {
		if(err.message.includes("appid"))
			inter.editReply({ content: "Cet id ne correspond à aucun jeu Steam.", ephemeral: true }).catch(error);
		else
		{
			error(err);
			inter.editReply({ content: "Une erreur est survenue.", ephemeral: true }).catch(error);
		}
	});
}
