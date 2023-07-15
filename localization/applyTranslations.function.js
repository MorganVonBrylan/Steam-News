"use strict";

module.exports = exports = function applyTranslations(cmdName, cmd)
{
	const {FALLBACK, locales} = this;
	for(const [locale, {commands}] of Object.entries(locales))
	{
		if(!commands || !(cmdName in commands))
			continue;

		if(locale === FALLBACK)
		{
			const {description, options} = commands[cmdName];
			if(!description)
				console.warn(`Missing fallback description for command ${cmdName}`);
			else
				cmd.description = description;

			if(cmd.options?.length)
			{
				if(!options)
					console.warn(`Missing fallback option translations for command ${cmdName}`);
				else for(const opt of cmd.options)
				{
					const tr = options[opt.name];
					if(!tr)
						console.warn(`Missing fallback translation for option ${opt.name} of command ${cmdName}`);
					else
					{
						const { description } = tr;
						if(!description)
							console.warn(`Missing fallback description for option ${opt.name} of command ${cmdName}`);
						else
							opt.description = description;
					}
				}
			}
			continue;
		}

		const {name, description, options} = commands[cmdName];

		if(cmd.nameLocalizations) cmd.nameLocalizations[locale] = name;
		else cmd.nameLocalizations = { [locale]: name };
		if(cmd.descriptionLocalizations) cmd.descriptionLocalizations[locale] = description;
		else cmd.descriptionLocalizations = { [locale]: description };

		if(!cmd.options?.length)
			continue;
		if(!options)
		{
			console.warn(`Missing ${locale} option translations for command ${cmdName}`);
			continue;
		}

		for(const opt of cmd.options)
		{
			const tr = options[opt.name];
			if(!tr)
				console.warn(`Missing ${locale} translation for option ${opt.name} of command ${cmdName}`);

			const {name, description, choices} = tr;
			if(opt.nameLocalizations) opt.nameLocalizations[locale] = name;
			else opt.nameLocalizations = { [locale]: name };
			if(opt.descriptionLocalizations) opt.descriptionLocalizations[locale] = description;
			else opt.descriptionLocalizations = { [locale]: description };

			if(!opt.choices?.length)
				continue;

			if(opt.choices.length !== choices?.length)
				console.warn(`Mismatched number of choices in ${locale} translation for option ${opt.name} of command ${cmdName} (expected ${opt.choices.length}, got ${choices?.length})`);

			for(let i = 0 ; i < choices.length ; ++i)
			{
				const choice = opt.choices[i];
				if(choice.nameLocalizations) choice.nameLocalizations[locale] = choices[i];
				else choice.nameLocalizations = { [locale]: choices[i] };
			}
		}
	} // for(const [locale, {commands}] of Object.entries(locales))
}
