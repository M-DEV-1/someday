/** Returns the element with this id, checked to be of the given type. Throws if the page does not have it, which means the page and this script disagree. */
export function byId<T extends Element>(id: string, type: abstract new () => T): T {
	const el = document.getElementById(id);
	if (!(el instanceof type)) throw new Error(`#${id} is missing or not a ${type.name}`);
	return el;
}

/** Returns the form control with this name, checked to be of the given type. */
export function control<T extends Element>(form: HTMLFormElement, name: string, type: abstract new () => T): T {
	const el = form.elements.namedItem(name);
	if (!(el instanceof type)) throw new Error(`${name} is missing or not a ${type.name}`);
	return el;
}
