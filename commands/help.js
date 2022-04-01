"use strict";

const { WATCH_LIMIT } = require("../steam_news/watchers");
const SUPPORT_SERVER = require("../bot").auth.supportServer || "*(no support server invite set)*";

exports.global = true;
exports.description = "Get help about the bot.";
exports.run = inter => {
	setAvatars();
	inter.reply({ content: SUPPORT_SERVER, embeds: [helpEmbed], ephemeral: true }).catch(error);
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
		{ name: "Do I need to provide the game’s exact name?", value: "Nope! What Steam News will do is make a search, and use the first result. If what you write is close enough, it will find it! For instance, to follow Team Fortress 2, `/watch team fortress` is enough." },
		{ name: "How do I find a game’s id?", value: "It’s the number after `/app` in the game’s Steam store page’s URL. From the Steam app, you can get that URL by right clicking → Copy page URL.\nFor instance, TF2’s address is `https://store.steampowered.com/app/440/Team_Fortress_2/`, so TF2’s id is 440." },
		{ name: "The bot didn’t send the latest news at the second it came out!", value: "Indeed. It checks for news once an hour, so there can be up to an hour of delay." },
		{ name: "What about NSFW games?", value: "The bot will only send info and news about NSFW games in NSFW channels." },
		{ name: "Can I copy your bot?", value: `Sure! It’s open sourced under the GNU GPL 3.0 licence.\nHere is the Git repository: [${repository}](${repository})` },
		{ name: "I still need help!", value: "That is unfortunate. You can come explain your issue on our support server: "+SUPPORT_SERVER },
		{ name: "One last thing", value: "Like Steam News? Consider upvoting in on Top.gg: https://top.gg/bot/929757212841226292" },
	],
	footer: { text: `Steam News v${version} by ${author}. Special thanks to Damn3d who gabe me the idea!` },
};
