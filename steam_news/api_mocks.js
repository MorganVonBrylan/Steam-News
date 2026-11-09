
/** @import {NewsItem} from "./api.js" */

const words = ["lorem", "ipsum", "dolor", "sit", "amet", "consectur", "adipiscing", "elit", "sed", "risus"];
console.assert(words.length === 10, "There should be 10 mock words");

function mockSentence(cutoff = 0) {
	return Math.random().toString().substring(cutoff + 2).split("").map(n => words[n]).join(" ");
}

/**
 * @param {number} appid 
 * @param {string} language 
 * @returns {Promise<{appid:number,newsitems:NewsItem[]}}
 */
export async function query(appid, language)
{
	const date = new Date();
	date.setHours(date.getHours() - 1);
	const fakeNews = {
		appid, eventId: +Math.random().toString().substring(2),
		url: "https://perdu.com/",
		title: `${language} ${appid} patch notes`,
		contents: `${mockSentence()}. ${mockSentence()}.\n${mockSentence()}!`,
		date: date.toUTCString(),
	};
	console.info("Fake news created:", fakeNews.title);
	return { appid, newsitems: [fakeNews] };
}