"use strict";

const { client: {users} } = require("../bot");

const { stmts: {getLastVote, insertLastVote, updateLastVote, getRecentVoters} } = require("./db");
const VOTE_NOTIFICATION_COOLDOWN = 604800_000; // 7 days
const VOTE_BONUS_DURATION = (exports.VOTE_BONUS_DURATION = 16) * 3600_000;
const voters = new Map();

for(const {id, lastVote} of getRecentVoters(Date.now() - VOTE_BONUS_DURATION))
	voters.set(id, setTimeout(voters.delete.bind(voters, id), Date.now() - lastVote));


exports.voted = voters.has.bind(voters);

exports.getVoters = () => [...voters.keys()];

exports.addVoter = (id, lang) => {
	clearTimeout(voters.get(id));
	voters.set(id, setTimeout(voters.delete.bind(voters, id), VOTE_BONUS_DURATION));

	const date = Date.now();
	const lastVote = getLastVote(id);
	if(!lastVote || date - lastVote > VOTE_NOTIFICATION_COOLDOWN)
		users.fetch(id).then(user => user.send(tr.get(lang || "en", "voting.thanks"))).catch(error);

	if(lastVote)
		updateLastVote({id, date});
	else
		insertLastVote({id, date});
}
