
import importJSON from "../importJSON.function.js";
const { WATCH_LIMIT, WATCH_VOTE_BONUS } = importJSON("steam_news/limits.json");
import { auth, myself, master } from "../bot.js";
const {
	donate: DONATE_LINK,
	supportServer: SUPPORT_SERVER = "*(no support server invite set)*",
} = auth;
const { repository: { url: repository }, version, author } = importJSON("package.json");
import { voteURL } from "../dbl.js";

const preparedEmbeds = new Set();

export const dmPermission = true;
export function run(inter)
{
	const {locale} = inter;
	const embed = tr.get(locale, "help");
	embed.thumbnail = { url: myself.avatarURL() };
	embed.footer.icon_url = master?.avatarURL({dynamic: true});

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

	inter.reply({ ephemeral: true, content: SUPPORT_SERVER, embeds: [embed] });
}
