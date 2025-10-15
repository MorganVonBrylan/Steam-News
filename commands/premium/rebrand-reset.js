
const AVATAR = 1<<0;
const BANNER = 1<<1;

export const description = "Reset the bot's appearance in this server (this is free)";
export const options = [{
	type: NUMBER, name: "what", required: true,
	description: "Choose what to reset.",
	choices: [
        { name: "Avatar", value: AVATAR },
        { name: "Banner", value: BANNER },
        { name: "Both", value: AVATAR | BANNER },
    ],
}];
export async function run(inter)
{
    const what = inter.options.getNumber("what");
	const t = tr.set(inter.locale, "premium");

    const options = {};
    if(what & AVATAR)
        options.avatar = null;
    if(what & BANNER)
        options.banner = null;

    inter.guild.members.editMe(options).then(() => {
        inter.reply(t("rebrand.resetSuccess"));
    }, (err) => {
        console.warn(err);
        inter.reply(t("rebrand.resetFailure", err.message));
    });
}