"use strict";

const { WATCH_LIMIT, WATCH_VOTE_BONUS } = require("../steam_news/limits");
const SUPPORT_SERVER = require("../bot").auth.supportServer || "*(no support server invite set)*";
const {repository: {url: repository}, version, author} = require("../package.json");
const { voteURL } = require("../dbl");

const preparedEmbeds = new Set();

exports.dmPermission = true;
exports.run = inter => {
	const {myself, master} = require("../bot");
	const {locale} = inter;

	const embed = tr.get(locale, "help");
	embed.thumbnail = { url: myself.avatarURL() };
	embed.footer.icon_url = master.avatarURL({dynamic: true});

	if(!preparedEmbeds.has(locale))
	{
		embed.footer.text = embed.footer.text.replace("${v}", version).replace("${author}", author);
		for(const field of embed.fields)
		{
			field.value = field.value
				.replace("${WATCH_LIMIT}", WATCH_LIMIT)
				.replace("${WATCH_VOTE_BONUS}", WATCH_VOTE_BONUS)
				.replace("${SUPPORT_SERVER}", SUPPORT_SERVER)
				.replaceAll("${repository}", repository)
				.replace("${VOTE}", voteURL(locale));
		}

		preparedEmbeds.add(locale);
	}

	inter.reply({ ephemeral: true, content: SUPPORT_SERVER, embeds: [embed] }).catch(error);
}
