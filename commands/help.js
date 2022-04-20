"use strict";

const { WATCH_LIMIT } = require("../steam_news/watchers");
const SUPPORT_SERVER = require("../bot").auth.supportServer || "*(no support server invite set)*";

exports.global = true;
exports.description = "Get help about the bot.";
exports.run = inter => {
	setAvatars();
	inter.reply({ ephemeral: true, content: SUPPORT_SERVER, embeds: [tr[inter.locale] || helpEmbed] }).catch(error);
}

function setAvatars()
{
	const {myself, master} = require("../bot");
	helpEmbed.thumbnail = { url: myself.avatarURL() };
	helpEmbed.footer.icon_url = master.avatarURL({dynamic: true});
}

const {repository: {url: repository}, version, author} = require("../package.json")
const helpEmbed = {
	title: "Steam News help",
	description: "**Steam News** is a bot that lets you follow Steam game news by sending community announcements, patch notes etc directly into a channel.",
	fields: [
		{ name: "How do I follow a game’s news?", value: `Add a watcher with \`/watch\`, remove it with \`/unwatch\`. Each server can follow up to ${WATCH_LIMIT} games at a time.` },
		{ name: "The bot didn’t send the latest news at the second it came out!", value: "That is normal. It checks for news once an hour, so there can be up to an hour of delay." },
		{ name: "What about NSFW games?", value: "The bot will only send info and news about NSFW games in NSFW channels." },
		{ name: "Can I copy your bot?", value: `Sure! It’s open sourced under the GNU GPL 3.0 licence.\nHere is the Git repository: [${repository}](${repository})` },
		{ name: "I still need help!", value: "That is unfortunate. You can come explain your issue on our support server: "+SUPPORT_SERVER },
		{ name: "One last thing", value: "Like Steam News? Consider upvoting it on Top.gg: https://top.gg/bot/929757212841226292" },
	],
	footer: { text: `Steam News v${version} by ${author}.` },
};


const tr = {
	fr: {
		title: "Aide Steam News",
		description: "**Steam News** est un bot qui permet de suivre les actus d’un jeu Steam en envoyant les annonces, notes de mises à jour etc directement dans un salon.",
		fields: [
			{ name: "Comment suivre les actus d’un jeu ?", value: `Ajoutez un abonnement avec \`/watch\`, retirez-le avec \`/unwatch\`. Chaque serveur peut suivre au maxium les actus de ${WATCH_LIMIT} jeux à la fois.` },
			{ name: "Le bot n’a pas envoyé une actu à la seconde où elle est sortie !", value: "C’est normal. Il vérifie les actus une fois pas heure, donc il peut y avoir jusqu’à une heure de retard." },
			{ name: "Qu’en est-il des jeux adultes ?", value: "Le bot n’enverra les infos et actus de jeux adultes que dans les salons soumis à une limite d’âge (NSFW)." },
			{ name: "Je peux copier ton bot ?", value: `Bien sûr ! Il est open source sous licence GNU GPL 3.0.\nVoici le dépôt Git : [${repository}](${repository})` },
			{ name: "Les commandes seront traduites un jour ?", value: "C’est prévu. Je le ferai dès que Discord.js le permettra. En attendant, il faudra se contenter de l’anglais, désolé." },
			{ name: "J’ai encore besoin d’aide !", value: "C’est fâcheux. Vous pouvez venir expliquer votre souci sur notre serveur de support : "+SUPPORT_SERVER },
			{ name: "Une dernière chose", value: "Vous aimez Steam News? Vous pouvez lui mettre un poce blo sur Top.gg: https://top.gg/bot/929757212841226292" },
		],
		footer: { text: `Steam News v${version} par ${author}.` },
	},
}
