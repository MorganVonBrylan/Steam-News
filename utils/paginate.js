
import { buttons, selectMenu, register, unregister } from "./components.js";
import { ButtonInteraction, ButtonStyle } from "discord.js";
const { Secondary: style } = ButtonStyle;
const registerOptions = { singleUse: true, timeout: 3600 };

/**
 * Show data in a paginated embed.
 * @param {ChatInputCommandInteraction|MessageComponentInteraction} interaction The interaction to use
 * @param {object} data 
 * @param {Array} data.items The data to paginate
 * @param {string} data.customId A custom id to use for the buttons (default to interaction id) (max 90 characters)
 * @param {number} data.pageLength How many items will be shown at a time
 * @param {number} data.page The page number at which to start, indexed at 0. Defaults to 0. 
 * @param {(slice: Array, range:{start:number,end:number,total:number,page:number,totalPages:number})=>object} data.renderer A function that takes a slice of the data and the range of items shown (indexed at 1 for convenient user display) and returns the embed.
 * @returns {Promise<InteractionResponse>} The interaction reponse promise
 */
export default function paginate(interaction, data)
{
	data.customId ??= interaction.id;
	data.page ??= 0;
	const { items, customId, pageLength, page, renderer } = data;
	if(!items?.length)
		throw new TypeError("The data is empty.");
	if(!Number.isInteger(pageLength) || pageLength <= 0)
		throw new TypeError("'pageLength' must be a positive integer.");
	if(!Number.isInteger(page) || page < 0)
		throw new TypeError("'page' must be a positive integer or 0.");
	if((""+customId).length > 90)
		throw new TypeError(`The customId is too long (max 90 chars, got ${(""+customId).length}: ${customId})`);

	const total = items.length;
	const totalPages = Math.ceil(total / pageLength);
	const shift = page * pageLength;
	if(shift >= total)
		throw new RangeError(`Requested page number (${page}) exceeds the number of pages (${totalPages})`);

	const embed = renderer(
		items.slice(shift, shift+pageLength),
		{ start: shift+1, end: Math.min(shift+pageLength+1, total), total, page, totalPages },
	);

	const chooseLabel = tr.get(interaction.locale, "page-display", {current: page, total: totalPages});

	const reply = { embeds: [embed] };
	if(total > pageLength)
	{
		const curPage = shift / 9 + 1;
		const components = [
			{style, label: "←", customId: `${customId}_prev`, disabled: !page},
			{style, label: chooseLabel, customId: `${customId}_choose`},
			{style, label: "→", customId: `${customId}_next`, disabled: !totalPages || curPage === totalPages},
		];
		const [prev, choose, next] = components;
		if(!prev.disabled)
			register(prev, inter => paginate(inter, {...data, page: page-1}), registerOptions);
		if(!next.disabled)
			register(next, inter => paginate(inter, {...data, page: page+1}), registerOptions);
		// This one is not single-use because the user can cancel the modal
		register(choose, choosePage.bind(data), { timeout: registerOptions.timeout });
		reply.components = [buttons(components)];
	}

	return interaction.customId ? interaction.update(reply)
		: interaction.deferred ? interaction.editReply(reply)
		: interaction.reply(reply);
}

/**
 * Shows a modal to let the user choose a page to display.
 * This function should be have the data bound as this
 * @param {ButtonInteraction} interaction The button interaction
 */
function choosePage(interaction)
{
	const { id, locale, customId: buttonId } = interaction;
	const { items, pageLength, page } = this;
	const totalPages = Math.ceil(items.length / pageLength);
	const customId = `${id}_paginate`;
	interaction.showModal({
		customId, title: tr.get(locale, "choose-page", totalPages),
		components: [selectMenu({
			label: tr.get(locale, "page-number"),
			customId: "page_select",
			options: Array.from({length: totalPages}, (_, i) => ({
				value: i,
				label: i+1+"",
				default: i === page,
			})),
		})],
	});

	register(customId, inter => {
		unregister(buttonId);
		paginate(inter, {
			...this,
			page: +inter.fields.getStringSelectValues("page_select")[0],
		})
	});
}