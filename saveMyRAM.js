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
	AnonymousGuild,
	BaseChannel,
	Role,
} from "discord.js";

function replace({prototype}, newPatch)
{
	prototype._truePatch = prototype._patch;
	Reflect.defineProperty(prototype, "_patch", { value: newPatch });
}

replace(AnonymousGuild, function(data) {
	delete data.name;
	delete data.description;
    this.patch = this._truePatch;
	this._truePatch(data);
});

replace(BaseChannel, function(data) {
	delete data.name;
	delete data.topic;
	this._truePatch(data);
});

replace(Role, function(data) {
	delete data.name;
	delete data.color;
	delete data.icon;
	delete data.unicode_emoji;
	this._truePatch(data);
});