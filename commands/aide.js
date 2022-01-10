"use strict";

const { WATCH_LIMIT } = require("../steam_news/watchers");

exports.description = "Affiche l'aide du bot.";
exports.run = inter => {
	setAvatars();
	inter.reply({ embeds: [helpEmbed], ephemeral: true }).catch(error);
}

function setAvatars()
{
	const {myself, master} = require("../bot");
	helpEmbed.thumbnail = { url: myself.avatarURL() };
	helpEmbed.footer.icon_url = master.avatarURL({dynamic: true});
}

const {repository: {url: repository}, version, author} = require("../package.json")
const helpEmbed = {
	title: "Aide de Actus Steam",
	description: "**Actus Steam** est un bot qui vous permet de suivre l'actualité de jeux Steam, envoyant les annonce des devs, patch notes etc directement dans un salon.",
	fields: [
		{ name: "Comment suivre les actus d’un jeu ?", value: `Ajoutez un suivi avec \`/suivre\`, retirez-le avec \`/ne-plus-suivre\`. Chaque serveur peut suivre au maximum ${WATCH_LIMIT} jeux à la fois.` },
		{ name: "Comment trouver l’id d’un jeu ?", value: "C’est le nombre après `/app` dans l’URL de la page du jeu dans le magasin Steam. Depuis l’application Steam, vous pouvez obtenir cette URL en faisant Clic droit -> Copier l’adresse de la page\nPar exemple, l’adresse de TF2 est `https://store.steampowered.com/app/440/Team_Fortress_2/`, donc l’id de TF2 est 440." },
		{ name: "Le bot n’a pas envoyé la dernière actu à la seconde où elle a été publiée !", value: "En effet. Il vérifie les actus une fois par heure, il peut donc y avoir jusqu’à une heure de délai." },
		{ name: "Qu’en est-il des jeux NSFW ?", value: "Le bot n’enverra d’infos et d’actus sur ces jeux que dans les salons marqués comme NSFW." },
		{ name: "Je peux copier ton bot ?", value: `Bien sûr ! Il est open source sous licence GNU GPL 3.0\nVoici le dépôt Git : [${repository}](${repository})` },
		{ name: "J’ai encore besoin d’aide !", value: "C’est fâcheux. Vous pouvez venir expliquer votre problème sur le serveur de support (qui s’appelle “Strun Bah Couille”, c’est normal, ça changera peut-être bientôt)\nhttps://discord.gg/CzPwBuv" },
		//{ name: "J’apprécie ton travail, tu as un Patreon ou quelque chose du genre ?", value: "Je ne veux guère de ton aumône, paltoquet ! Et merci." },
	],
	footer: { text: `Actus Steam v${version} par ${author}` },
};

require("../bot").client.once("ready", async () => {
})
