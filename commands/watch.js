"use strict";

const { STEAM_APPID } = require("../steam_news/api");
const interpretAppidOption = require("../interpretAppidOption.function");

const { WATCH_LIMIT, WATCH_VOTE_BONUS } = require("../steam_news/limits");
const LIMIT_WITH_VOTE = WATCH_LIMIT + WATCH_VOTE_BONUS;
const { voted } = require("../steam_news/VIPs");
const { voteURL } = require("../dbl");

const { watch, unwatch, getAppInfo, purgeApp } = require("../steam_news/watchers");
const {
	PermissionFlagsBits: { SendMessages: SEND_MESSAGES, EmbedLinks: EMBED_LINKS },
} = require("discord.js");

const updateUnwatch = require("@brylan/djs-commands").guildCommands.updateCmd.bind(null, require("./#guild/unwatch"));

exports.defaultMemberPermissions = "0";
exports.autocomplete = require("../autocomplete/search").appsOnly;
exports.options = [{
	type: STRING, name: "type", required: true,
	description: "Whether to watch news or price changes",
	choices: [{name: "News", value: "news"}, {name: "Price", value: "price"}],
}, {
	type: STRING, name: "game", required: true,
	description: "The game’s name or id",
	autocomplete: true,
}, {
	type: ROLE, name: "role",
	description: "A role to ping when news are posted",
}, {
	type: CHANNEL, name: "channel",
	channelTypes: ALL_TEXT_CHANNEL_TYPES,
	description: "The channel where to send the news (defaults to current channel if not provided)"
}];
exports.run = async inter => {
	const channel = inter.options.getChannel("channel") || inter.channel;
	const perms = channel.permissionsFor(await inter.guild.members.fetchMe());
	const t = tr.set(inter.locale, "watch");

	if(!perms?.has(SEND_MESSAGES))
		return inter.reply({ephemeral: true, content: t("cannot-send", channel)});
	else if(!perms.has(EMBED_LINKS))
		return inter.reply({ephemeral: true, content: t("cannot-embed", channel)});

	const { appid, defer } = await interpretAppidOption(inter, true);
	if(!appid)
		return;
	else if(+appid === STEAM_APPID)
		return defer.then(() => inter.editReply({ephemeral: true, content: tr.get(inter.locale, "no-match", appid)}));

	const LIMIT = voted(inter.user.id) ? LIMIT_WITH_VOTE : WATCH_LIMIT;
	const role = inter.options.getRole("role")?.id;
	const type = inter.options.getString("type");
	const watchPrice = type === "price";

	watch(+appid, channel, role, watchPrice, LIMIT).then(async success => {
		await defer;
		const details = getAppInfo(appid);

		if(!details)
		{
			purgeApp(appid);
			return inter.editReply({ephemeral: true, content: t.get(inter.locale, "bad-appid")});
		}

		if(watchPrice)
		{
			if(success === null)
				return inter.editReply({ephemeral: true, content: t("price-free")});
			if(success === false)
				return inter.editReply({ephemeral: true, content: t("price-unknown")});
		}

		if(details.type === "dlc" && !watchPrice)
		{
			purgeApp(appid);
			return inter.editReply({ephemeral: true, content: t.get(inter.locale, "no-DLC-news")});
		}

		if(details.nsfw && !channel.nsfw)
		{
			unwatch(appid, inter.guild);
			return inter.editReply(tr.get(inter.locale, `NSFW-content-${type}`));
		}

		let reply = success
			? t(`confirm-${type}`, details.name, channel)
			: t(`already-${type}`, details.name);
		
		if(detailsError.name === "undefined")
			reply += `\n${t("error-retrieving-details")}`;

		if(success === LIMIT)
			reply += LIMIT === LIMIT_WITH_VOTE
				? `\n${t("server-limit-reached-voted", LIMIT)}`
				: `\n${t("server-limit-reached", LIMIT, WATCH_VOTE_BONUS, voteURL(inter.locale))}`;

		updateUnwatch(inter.guild);
		inter.editReply(reply);
	}, async err => {
		await defer;
		if(err.message.includes("appid"))
			inter.editReply({ephemeral: true, content: tr.get(inter.locale, "bad-appid")});
		else if(err instanceof RangeError)
			inter.editReply({ephemeral: true, content: LIMIT === LIMIT_WITH_VOTE
				? t("error-limit-reached-voted", LIMIT)
				: t("error-limit-reached", LIMIT, WATCH_VOTE_BONUS, voteURL(inter.locale))
			});
		else
		{
			error(err);
			inter.editReply({ephemeral: true, content: tr.get(inter.locale, "error")});
		}
	});
}
