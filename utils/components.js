
import { ComponentType, ButtonStyle } from "discord.js";
const {	ActionRow: ACTION_ROW, StringSelect: STRING_SELECT, Button: BUTTON } = ComponentType;
const { Primary: PRIMARY } = ButtonStyle;


export function selectMenu(customId, options, minValues = 1, maxValues = 1)
{
	return {
		type: ACTION_ROW,
		components: [{ type: STRING_SELECT, customId, options, minValues, maxValues }],
	};
}

export function buttons(...buttons)
{
	if(buttons[0] instanceof Array)
		[buttons] = buttons;
	return { type: ACTION_ROW, components: buttons.map(button => ({type: BUTTON, style: PRIMARY, ...button})) };
}


const components = new Map();

/**
 * Registers a component for interaction handling.
 * If a component with the same custom id is already registered, it will be overwritten.
 * @param {string|MessageComponent} customId The component's custom id, or the component itself
 * @param {function} callback The Callback, which will be passed the interaction
 * @param {object} options 
 * @param {boolean} options.singleUse Whether this component is single-use or not. Defaults to false.
 * @param {number} options.timeout The amount of time (in seconds) after which the component will be un-registered. Defaults to 180.
 *
 * @returns {boolean} true if the component was registered, false if there was already one with that id
 * @throws {TypeError}
 */
export function register(customId, callback, { singleUse = false, timeout = 180})
{
	if(customId.customId)
		customId = customId.customId;

	if(typeof callback !== "function")
		throw new TypeError("'callback' must be a function");
	if(!Number.isInteger(timeout) || timeout <= 0)
		throw new TypeError("'timeout' must be a positive integer");

	if(components.has(customId))
		clearTimeout(components.get(customId).clear);
	components.set(customId, {
		callback,
		singleUse,
		clear: setTimeout(() => components.delete(customId), timeout*1000),
	});
	return true;
}


export const registered = components.has.bind(components);


/**
 * Handles the given component interaction, calling the appropriate callback if a component with the same custom id was registered (it is then un-registered).
 * @param {MessageComponentInteraction} interaction The interaction
 * @returns {boolean} true if the interaction was handled, false if no component with the same custom id was registered.
 */
export function handleInteraction(interaction)
{
	const component = components.get(interaction.customId);
	if(!component)
		return false;

	if(component.singleUse)
	{
		components.delete(interaction.customId);
		clearTimeout(component.clear);
	}
	component.callback(interaction);
	return true;
}
