/**
 * SAVE MY RAM!
 * 
 * Discord.js looooves caching.
 * And while a lot of caches can be disabled, not all of them.
 * And when it caches something, it caches ALL of the thing.
 * That means megs upon megs of names, descriptions etc that this bot DOES NOT USE
 * Therefore I am doing the heinous act of *patching a library*
 * 
 * INSTRUCTIONS
 * 
 * Only patch classes whose _patch method does NOT CALL super._patch
 * Otherwise you will get infinite recursion.
 */

import {
	Options,
	AnonymousGuild,
	BaseChannel,
	Role,
	ApplicationCommand,
} from "discord.js";


export const cacheLimits = Options.cacheWithLimits({
	...Options.DefaultMakeCacheSettings,
	UserManager: 0,
	GuildMemberManager: 0,
	VoiceStateManager: 0,
	ThreadMemberManager: 0,
	StageInstanceManager: 0,
	GuildForumThreadManager: 0,
	GuildTextThreadManager: 0,

	MessageManager: 0,
	GuildMessageManager: 0,
	DMMessageManager: 0,

	BaseGuildEmojiManager: 0,
	GuildEmojiManager: 0,
	GuildStickerManager: 0,
	GuildBanManager: 0,
	GuildInviteManager: 0,
	GuildScheduledEventManager: 0,
	AutoModerationRuleManager: 0,
});


function patch({prototype}, patchData)
{
	const className = prototype.constructor.name;
	if(!Object.hasOwn(prototype, "_patch"))
		throw new TypeError(`${className} does not have a '_patch' method.`);

	prototype._truePatch = prototype._patch;
	if(Reflect.defineProperty(prototype, "_patch",
		{ value: function(data) { patchData(data); return this._truePatch(data); }})
	)
		console.info(`Patched: ${className}`);
	else
		console.error(`Redefining '_patch' on ${className} failed.`);
}

patch(AnonymousGuild, (data) => {
	delete data.name;
	delete data.description;
});

patch(BaseChannel, (data) => {
	delete data.name;
	delete data.topic;
});

patch(Role, (data) => {
	delete data.name;
	delete data.color;
	delete data.icon;
	delete data.unicode_emoji;
});

/* This may seem like a bad idea, however djs-commands does not use Discord.js command objects.
 * It uses its own cache, made of the imported command files.
 * The only thing it does require is the name, as it uses that to retrieve it for updating/deleting.
 */
patch(ApplicationCommand, (data) => {
	delete data.name_localizations;
	delete data.description;
	delete data.description_localizations;
	delete data.options;
});