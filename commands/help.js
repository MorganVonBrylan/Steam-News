"use strict";

const { WATCH_LIMIT } = require("../steam_news/limits");
const SUPPORT_SERVER = require("../bot").auth.supportServer || "*(no support server invite set)*";
const {repository: {url: repository}, version, author} = require("../package.json");

exports.dmPermission = true;
exports.run = inter => {
	const {myself, master} = require("../bot");
	const embed = {
		...tr.get(inter.locale, "help"),
		thumbnail: { url: myself.avatarURL() },
	};
	embed.footer.icon_url = master.avatarURL({dynamic: true});
	embed.footer.text = embed.footer.text.replace("${v}", version).replace("${author}", author);

	for(const field of embed.fields)
	{
		field.value = field.value
			.replace("${WATCH_LIMIT}", WATCH_LIMIT)
			.replace("${SUPPORT_SERVER}", SUPPORT_SERVER)
			.replaceAll("${repository}", repository);
	}

	inter.reply({ ephemeral: true, content: SUPPORT_SERVER, embeds: [embed] }).catch(error);
}
