
import { client } from "../bot.js";

import { stmts } from "./db.js";
const { getLastVote, insertLastVote, updateLastVote, getRecentVoters } = stmts;
const VOTE_NOTIFICATION_COOLDOWN = 604800_000; // 7 days
const VOTE_BONUS_DURATION = 57600_000; // 16 hours

const voters = new Map();
function setVoter(id, timeout)
{
	clearTimeout(voters.get(id));
	voters.set(id, setTimeout(voters.delete.bind(voters, id), timeout));
}

for(const {id, lastVote} of getRecentVoters(Date.now() - VOTE_BONUS_DURATION))
	setVoter(id, Date.now() - lastVote);


export const voted = voters.has.bind(voters);

export function getVoters() { return [...voters.keys()]; }

export function addVoter(id, lang, forceNotif = false)
{
	setVoter(id, VOTE_BONUS_DURATION);

	const date = Date.now();
	const lastVote = getLastVote(id);
	if(forceNotif || !lastVote || date - lastVote > VOTE_NOTIFICATION_COOLDOWN)
	{
		client.users.fetch(id)
			.then(user => user.send(tr.get(lang || "en", "voting.thanks")))
			.catch(Function());
	}

	if(lastVote)
		updateLastVote({id, date});
	else
		insertLastVote({id, date});
}
