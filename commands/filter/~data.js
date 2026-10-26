

import auth from "../../auth.json" with { type: "json" };
export const dbl_url = auth.dbl?.uri
	? `https://discordbotlist.com/bots/${auth.dbl.uri}`
	: null;
export const dbl_link = dbl_url
	? `[DiscordBotList](${dbl_url})`
	: "*[oops, no DiscordBotLink URL]*";
export const dbl_link_suppressed = dbl_url
	? `[DiscordBotList](<${dbl_url}>)`
	: dbl_link;

export const MAX_FREE = 1;
export const VOTE_BONUS = 4;
export const MAX_WITH_VOTE = MAX_FREE + VOTE_BONUS;


/*
=== HOW FILTER CATEGORIES WORK ===

There is one free slot, VOTE_BONUS vote slots, and infinite premium slots.

Having a premium/gold subscription counts as having voted. i.e the bot will use an available vote slot even if you haven't voted, as long as your have an active subscription.

When creating a filter, in order:
- If the free slot is available, use it.
- If the user voted and vote slots are available, use a vote slot.
- Otherwise use a premium slot if the server has a premium/gold subscription.

When editing a filter:
- Its slot is kept.
- If it's using a vote slot, the user needs to have an active vote OR premium/gold subscription to edit it.
- If there is no active subscription, premium filters cannot be edited, since they are disabled anyway.

When filtering news:
- Free and vote filters always work, even if there is no active vote.
- Premium filters only work if there is an active premium/gold subscription.
*/