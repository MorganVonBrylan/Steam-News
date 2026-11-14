
const {
	create, assign, freeze,
	values, isFrozen,
} = Object;

/**
 * @type {<T extends object>(object: T) => Readonly<T>}
 * Freeze an object recursively.
 * @param object The object to freeze
 * @returns The frozen object with frozen properties
 */
export function deepFreeze(object)
{
	freeze(object);
	for(const prop of values(object))
		if(prop && typeof prop === "object" && !isFrozen(object))
			deepFreeze(prop);
	return object;
}

/**
 * @type {<T extends object>(props: T) => T}
 * Makes a null-prototype object.
 * @param {T} props A list of properties
 * @returns {T} A null-prototype object with all the enumerable own properties of props.
 */
export function dictionary(props = {})
{
	return assign(create(null), props);
}

/**
 * @type {<T extends object>(props: T) => Readonly<T>}
 * Makes a deeply frozen, null-prototype object.
 * @param {T} props A list of properties
 * @returns A frozen, null-prototype object with all the enumerable own properties of props.
 * @see deepFreeze
 */
export function fixedDictionary(props)
{
	return deepFreeze(assign(create(null), props));
}


/**
 * @typedef {(entryName:string)=>*} MapperFunction
 * @typedef {{[entryName:string]: *}} Dictionary
 * 
 * @overload
 * @param {string[]} entryNames @param {MapperFunction} map @param {true} [freeze]
 * @return {Readonly<Dictionary>}
 * @overload
 * @param {string[]} entryNames @param {MapperFunction} map @param {false} freeze
 * @return {Dictionary}
 * 
 * Generate a dictionary with a list of entries with a mapping function.
 * @param {string[]} entryNames The entry names.
 * @param {(entryName:string)=>*} map A function that will map an entry name to its value.
 * @param {boolean} [freeze] Default: true. Whether to deep-freeze the dictionary.
 * @returns {Dictionary|Readonly<Dictionary>} A dictionary
 * @see deepFreeze
 */
export function generateDictionary(entryNames, map, freeze = true)
{
	const dictionary = create(null);
	for(const entry of entryNames)
		dictionary[entry] = map(entry);
	return freeze ? deepFreeze(dictionary) : dictionary;
}