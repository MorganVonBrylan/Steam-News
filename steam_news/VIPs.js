"use strict";

const voters = new Map();

exports.voted = voters.has.bind(voters);

exports.getVoters = () => [...voters.keys()];

exports.addVoter = id => {
	clearTimeout(voters.get(id));
	voters.set(id, setTimeout(() => voters.delete(id), 86400_000)); // 24 hours
}
