
const {
	create, assign, freeze,
	values, isFrozen,
} = Object;

/**
 * @type {<T extends object>(props: T) => T}
 * Freeze an object recursively.
 * @param {T} object The object to freeze
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
 * @type {<T extends object>(props: T) => T}
 * Makes a deeply frozen, null-prototype object.
 * @param {T} props A list of properties
 * @returns {T} A frozen, null-prototype object with all the enumerable own properties of props.
 * @see deepFreeze
 */
export function fixedDictionary(props)
{
	return deepFreeze(assign(create(null), props));
}