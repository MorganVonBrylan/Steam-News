"use strict";

const VOTE_BONUS_DURATION = (exports.VOTE_BONUS_DURATION = 16) * 3600_000;
const voters = new Map();

exports.voted = voters.has.bind(voters);

exports.getVoters = () => [...voters.keys()];

exports.addVoter = id => {
	clearTimeout(voters.get(id));
	voters.set(id, setTimeout(voters.delete.bind(voters, id), VOTE_BONUS_DURATION));
}
