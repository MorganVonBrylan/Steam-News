"use strict";

const { WATCH_LIMIT, WATCH_VOTE_BONUS } = require("../steam_news/limits");
const { donate: DONATE_LINK, supportServer: SUPPORT_SERVER = "*(no support server invite set)*" } = require("../bot").auth;
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
				.replace("${repository}", repository)
				.replace("${VOTE}", voteURL(locale));
		}

		if(DONATE_LINK)
			embed.fields[embed.fields.length-1].value += `\n${tr.get(locale, "help.donate")} ${DONATE_LINK}`;

		preparedEmbeds.add(locale);
	}

	inter.reply({ ephemeral: true, content: SUPPORT_SERVER, embeds: [embed] }).catch(error);
}
