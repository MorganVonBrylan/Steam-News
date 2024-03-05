/**
 * Get a localization helper.
 * @param {string} cmdName The command name
 * @returns {{get: function, optionLocalizations: function}} 
 */
export default function(cmdName)
{
	return Object.assign(
		Object.entries(tr.getAll(`commands.${cmdName}`, true)),
		LocalizationHelper
	);
}


const LocalizationHelper = {
	/**
	 * Get the localizations of a command's property
	 * @param {string} property 
	 * @returns {object} The localizations mapped by language code
	 */
	get(property) {
		return this.reduce((localization, [locale, tr]) => {
			localization[locale] = tr[property];
			return localization;
		}, {});
	},

	/**
	 * Get the localizations of an option
	 * @param {string} optionName The option name
	 * @returns {object} The option's localized properties
	 */
	optionLocalizations(optionName) {
		return this.reduce((optLocalization, [locale, tr]) => {
			const {name, description} = tr.options[optionName];
			if(name.length > 32)
				throw new Error(`Option name too long (>32) in ${locale}: ${name}`);
			if(description.length > 100)
				throw new Error(`Option description too long (>100) in ${locale}: ${name}`);
			optLocalization.nameLocalizations[locale] = name;
			optLocalization.descriptionLocalizations[locale] = description;
			return optLocalization;
		}, {
			nameLocalizations: {},
			descriptionLocalizations: {},
		});
	},
}
