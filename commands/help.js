
import importJSON from "../utils/importJSON.function.js";
const { WATCH_LIMIT, WATCH_VOTE_BONUS } = importJSON("steam_news/limits.json");
import { auth, myself, master } from "../bot.js";
const {
	donate: DONATE_LINK,
	supportServer: SUPPORT_SERVER = "*(no support server invite set)*",
} = auth;
const { repository: { url: repository }, version, author } = importJSON("package.json");
import { voteURL } from "../topGG.js";
import { trReplace } from "../localization/index.js";

const preparedEmbeds = new Set();

export const integrationTypes = ALL_INTEGRATION_TYPES;
export const contexts = ALL_CONTEXTS;
export function run(inter)
{
	const {locale} = inter;
	const embed = tr.get(locale, "help");
	embed.thumbnail = { url: myself.avatarURL() };
	embed.footer.icon_url = master?.avatarURL({dynamic: true});

	if(!preparedEmbeds.has(locale))
	{
		embed.footer.text = trReplace(embed.footer.text, { v: version, author });
		for(const field of embed.fields)
		{
			field.value = trReplace(field.value, {
				WATCH_LIMIT, WATCH_VOTE_BONUS, VOTE: voteURL(locale),
				SUPPORT_SERVER, repository, 
			});
		}

		if(DONATE_LINK)
			embed.fields[embed.fields.length-1].value += `\n${tr.get(locale, "help.donate")} ${DONATE_LINK}`;

		preparedEmbeds.add(locale);
	}

	inter.reply({ flags: "Ephemeral", content: SUPPORT_SERVER, embeds: [embed] });
}
