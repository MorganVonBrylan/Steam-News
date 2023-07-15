"use strict";


module.exports = exports = cmdName => Object.assign(Object.entries(tr.getAll("commands."+cmdName, true)), LocalizationHelper);


const LocalizationHelper = {
	get: function(property) {
		return this.reduce((localization, [locale, tr]) => {
			localization[locale] = tr[property];
			return localization;
		}, {});
	},

	optionLocalizations: function(optionName) {
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
