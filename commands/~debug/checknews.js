
import { checkForNews } from "../../steam_news/watchers.js";

export const description = "Forces checking the news";
export function run(inter)
{
    checkForNews().then(n => inter.reply({ ephemeral: true, content: `Sent ${n} news` }));
}
