
/** @import {NewsItem, GroupPost} from "./api.js" */

const words = ["lorem", "ipsum", "dolor", "sit", "amet", "consectur", "adipiscing", "elit", "sed", "risus"];
console.assert(words.length === 10, "There should be 10 mock words");

function mockSentence(cutoff = 0) {
	return Math.random().toString().substring(cutoff + 2).split("").map(n => words[n]).join(" ");
}
function mockId() {
	return +Math.random().toString().substring(2);
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
		appid, eventId: mockId(),
		url: "https://perdu.com/",
		title: `${language} ${appid} patch notes`,
		contents: `${mockSentence()}. ${mockSentence()}.\n${mockSentence()}!`,
		date: date.toUTCString(),
	};
	console.info("Fake news created:", fakeNews.title);
	return { appid, newsitems: [fakeNews] };
}

/**
 * @param {number} clanid
 * @param {string} lang
 * @returns {Promise<{appid:number,newsitems:GroupPost[]}}
 */
export async function queryGroup(clanid, lang)
{
	const date = ~~(Date.now() / 1000) - 3600;
	const nComments = ~~(Math.random() * 15);
	const fakeNews = {
		clanid, gid: mockId(),
		headline: `${lang} ${clanid} announcement`,
		posttime: date, updatetime: date,
		body: `${mockSentence()}. ${mockSentence()}.\n${mockSentence()}!`,
		commentcount: nComments,
		voteupcount: 10 + ~~(nComments * Math.random() * 10),
		votedowncount: ~~(nComments * Math.random() * 3),
		tags: [],
		language: 0,
		additionalData: Object.null,
	};
	console.info("Fake news created:", fakeNews.headline);
	return { clanid, newsitems: [fakeNews] };
}