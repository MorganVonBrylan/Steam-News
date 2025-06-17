
export default function applyTranslations(cmdName, cmd)
{
	const {FALLBACK, locales} = this;
	for(const [locale, {commands}] of Object.entries(locales))
	{
		if(!commands)
		{
			console.warn(`Missing ${locale} command translations`);
			continue;
		}

		if(locale === FALLBACK)
		{
			if(!(cmdName in commands))
			{
				console.warn(`Missing fallback translation for command ${cmdName}`);
				continue;
			}

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
					const forOption = `for option ${opt.name} of command ${cmdName}`;
					const tr = options[opt.name];
					if(!tr)
						console.warn(`Missing fallback translation ${forOption}`);
					else
					{
						const { description, choices } = tr;
						if(!description)
							console.warn(`Missing fallback description ${forOption}`);
						else
							opt.description = description;

						const nChoices = opt.choices?.length;

						if(nChoices && nChoices !== choices?.length)
						{
							console.warn(`Mismatched number of fallback choices ${forOption} (expected ${nChoices}, got ${choices?.length})`);
						}
					}
				}
			}
			continue;
		}

		if(!(cmdName in commands))
		{
			console.warn(`Missing ${locale} translation for command ${cmdName}`);
			continue;
		}


		const { name, description, options } = commands[cmdName];

		if(!name)
			console.warn(`Missing ${locale} name translation for command ${cmdName}`);
		else
		{
			if(cmd.nameLocalizations) cmd.nameLocalizations[locale] = name;
			else cmd.nameLocalizations = { [locale]: name };
		}

		if(!description)
			console.warn(`Missing ${locale} description translation for command ${cmdName}`);
		else
		{
			if(cmd.descriptionLocalizations) cmd.descriptionLocalizations[locale] = description;
			else cmd.descriptionLocalizations = { [locale]: description };
		}

		if(!cmd.options?.length)
			continue;

		if(!options)
			console.warn(`Missing ${locale} option translations for command ${cmdName}`);
		else for(const opt of cmd.options)
		{
			const forOption = `translation for option ${opt.name} of command ${cmdName}`;
			let tr = options[opt.name];
			if(!tr)
			{
				console.warn(`Missing ${locale} ${forOption}`);
				continue;
			}

			let { name, description, choices } = tr;

			if(!name)
				console.warn(`Missing ${locale} name ${forOption}`);
			else
			{
				if(opt.nameLocalizations) opt.nameLocalizations[locale] = name;
				else opt.nameLocalizations = { [locale]: name };
			}

			if(!description)
				console.warn(`Missing ${locale} description ${forOption}`);
			else
			{
				if(opt.descriptionLocalizations) opt.descriptionLocalizations[locale] = description;
				else opt.descriptionLocalizations = { [locale]: description };
			}

			const nChoices = opt.choices?.length;
			if(!nChoices)
				continue;

			if(nChoices !== choices?.length)
			{
				console.warn(`Mismatched number of choices in ${locale} ${forOption} (expected ${nChoices}, got ${choices?.length})`);
			}
			else for(let i = 0 ; i < nChoices ; ++i)
			{
				const choice = opt.choices[i];
				if(choice.nameLocalizations) choice.nameLocalizations[locale] = choices[i];
				else choice.nameLocalizations = { [locale]: choices[i] };
			}
		}
	} // for(const [locale, {commands}] of Object.entries(locales))
}
