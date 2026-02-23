
import importJSON from "../utils/importJSON.function.js";
/** @type {{baseWatcherLimit:number,topGG:?{voteWatcherBonus:number},premium:?{bonus:number}}} */
const { baseWatcherLimit, topGG, premium } = importJSON("auth.json");

export const WATCH_LIMIT = baseWatcherLimit ?? 25;
export const WATCH_VOTE_BONUS = topGG?.voteWatcherBonus ?? 25;
export const WATCH_PREMIUM_BONUS = premium?.bonus ?? 250;
