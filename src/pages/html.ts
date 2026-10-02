/** Markup that is safe to insert as it is. Only `html` and `raw` make one, so any plain string put into a page goes through escaping. */
export class Html {
	constructor(readonly value: string) {}

	toString(): string {
		return this.value;
	}
}

type Part = Html | string | number | boolean | null | undefined | readonly Part[];

/**
 * Builds markup from a template literal.
 * Strings and numbers placed in it are escaped for element content and quoted attributes; `Html` values and arrays of them go in unchanged; `false`, `true`, `null` and `undefined` add nothing, so `${cond && html`...`}` works.
 */
export function html(strings: TemplateStringsArray, ...parts: Part[]): Html {
	let out = strings[0] ?? "";
	for (const [i, part] of parts.entries()) out += render(part) + (strings[i + 1] ?? "");
	return new Html(out);
}

/** Marks text as markup without escaping it. Use it only for text the code itself wrote, such as the stylesheet. */
export function raw(text: string): Html {
	return new Html(text);
}

function render(part: Part): string {
	if (part instanceof Html) return part.value;
	if (Array.isArray(part)) return part.map(render).join("");
	if (typeof part === "string" || typeof part === "number") return String(part).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
	return "";
}
