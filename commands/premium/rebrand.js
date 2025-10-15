
import { rebrandSKU, buttons } from "../../steam_news/VIPs.js";
const rebrandButton = buttons(rebrandSKU);

const MAX_SIZE = 1_000_000;
const gracePeriod = new Set();

export const description = "Change the bot's appearance in this server";
export const options = [{
	type: ATTACHMENT, name: "avatar",
	description: "The bot's new profile picture.",
}, {
	type: ATTACHMENT, name: "banner",
	description: "The bot's new banner.",
}];
export async function run(inter)
{
	const t = tr.set(inter.locale, "premium");
    if(!rebrandSKU)
    {
        inter.reply({flags: "Ephemeral", content: t("rebrand.disabled")});
        return;
    }

    const { guild: { id, members } } = inter;
    const entitlement = inter.entitlements.find(({skuId}) => skuId === rebrandSKU);
    if((!entitlement || entitlement.consumed) && !gracePeriod.has(id))
    {
        inter.reply({flags: "Ephemeral",
            content: t("rebrand.pay"),
            components: [rebrandButton],
        });
        return;
    }

    const avatar = inter.options.getAttachment("avatar");
    const banner = inter.options.getAttachment("banner");

    if(!avatar && !banner)
        inter.reply({flags: "Ephemeral", content: t("rebrand.missing-args")});
    else if(avatar?.size > MAX_SIZE || banner?.size > MAX_SIZE)
        inter.reply({flags: "Ephemeral", content: t("rebrand.too-large")});
    else
    {
        await inter.deferReply();
        try {
            await members.editMe({ avatar: avatar?.url, banner: banner?.url });
            entitlement?.consume();
            let msg = t("rebrand.success");
            if(!gracePeriod.has(id))
            {
                msg += `\n${t("rebrand.grace")}`;
                gracePeriod.add(id);
                setTimeout(gracePeriod.delete.bind(gracePeriod, id), 3600_000);
            }
            inter.editReply(msg);
        }
        catch(err) {
            console.error(err);
            inter.editReply({content: t("rebrand.failure", err.message)});
        }
    }
}