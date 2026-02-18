
global.error = error;
process.on("unhandledRejection", error);

import { sendToMaster } from "../bot.js";
import { DiscordAPIError } from "discord.js";
import TopGGAPIError_ from "@top-gg/sdk/dist/utils/ApiError.js";
const TopGGAPIError = TopGGAPIError_.default;

import importJSON from "./importJSON.function.js";
const settings = importJSON("errors.json", {
	ignore: { status: ">=500" },
	truncate: {
		status: 408,
		message: "read ECONNRESET",
	},
	downgrade: {
		status: [403, 404],
		message: ["Unknown interaction", "^invalid json response body"],
	},
});
settings.ignore ??= Object.null;
settings.simplify ??= Object.null;
settings.downgrade ??= Object.null;
Object.freeze(settings);

const IGNORE = 1, SIMPLIFY = 1<<1, DOWNGRADE = 1<<2;
function testRule(value, rule) {
	switch(rule[0])
	{
		case "^": return value.startsWith(rule.substring(1));
		case "*": return value.includes(rule.substring(1));
		case "$": return value.endsWith(rule.substring(1));
		case ">": return value > rule.substring(1);
		case "≥": return value >= rule.substring(1);
		case "<": return value < rule.substring(1);
		case "≤": return value <= rule.substring(1);
		case "\\": return value === rule.substring(1);
		default: return value === rule;
	}
}
function test(value, rules) {
	return !value ? false
		: rules instanceof Array ? rules.some(testRule.bind(null, value))
		: testRule(value, rules);
}
function specialTreatment(err)
{
	const { ignore, simplify, downgrade } = settings;
	for(const rule in ignore)
		if(test(err[rule], ignore[rule]))
			return IGNORE;
	let flags = 0;
	for(const rule in simplify)
		if(test(err[rule], simplify[rule]))
		{
			flags = SIMPLIFY;
			break;
		}
	for(const rule in downgrade)
		if(test(err[rule], downgrade[rule]))
		{
			flags |= DOWNGRADE;
			break;
		}
	return flags;
};

const recent = new Set();

export default error;
export function error(err)
{
	if(err instanceof SyntaxError) // from an import probably
		throw err;
	
	if(!err
		|| err instanceof DOMException // Discord.js failing some random call
		|| err instanceof TopGGAPIError && err.response.statusCode === 429 // occasional Top.gg bug
	)
		return;

	const { message } = err;
	const treatment = specialTreatment({ message,
		code: err.code || err.cause?.code,
		status: err instanceof TopGGAPIError ? err.response?.statusCode
			: (err.httpStatus || err.code || err.response?.status || err.response?.statusCode),
	});
	if(treatment === IGNORE) return;

	const log = treatment & DOWNGRADE ? console.warn : console.error;
	if(log === Function.noop) return;

	if(treatment & SIMPLIFY)
	{
		log(new Date(), err.constructor.name, message);
		return;
	}
	
	log(new Date(), err);

	let msg = "An error occurred; read the console for details.";

	if(message)
	{
		if(err instanceof DiscordAPIError)
		{
			msg += `\nMessage : ${message}\nPath : ${err.path || err.url}`;
			log("data:", err.requestBody?.json?.data);
		}
		else
			msg += `\nMessage : ${message}`;
	}
	else
		msg += `\n${err}`;

	if(!recent.has(msg))
	{
		sendToMaster(msg, console.error);
		recent.add(msg);
		setTimeout(recent.delete.bind(recent, msg), 3600_000);
	}
}


export function commandRegisterError(err)
{
	console.error(err.message);
	if(err.message.startsWith("Invalid Form Body"))
	{
		const path = err.message.substring("Invalid Form Body".length+1).split(".");
		const id = path[0];
		let offender = err.requestBody.json[id];
		const offenderName = offender.name;
		for(let i = 1 ; i < path.length ; i++)
		{
			const [, prop, index] = path[i].match(/([^\[]+)\[(.+)\]/);
			if(typeof offender === "object" && prop in offender) offender = offender[prop];
			else break;
			if(typeof offender === "object" && index in offender) offender = offender[index];
			else break;
		}
		console.error("Offender:", offenderName, "->", offender);
	}
	sendToMaster(err.message);
}