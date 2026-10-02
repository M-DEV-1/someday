import type { View } from "../http";
import { DELIVERY_CHOICES, FONTS, SIZES, THEMES, type Settings } from "../settings";
import { esc, layout } from "./layout";

const NAMES: Record<string, string> = { auto: "System", light: "Light", dark: "Dark", serif: "Serif", sans: "Sans", mono: "Mono" };

/** The settings page. `settings` is what the form shows, which after a failed save is what was submitted; `to` is the owner's address. The owner's custom CSS is left out of this page. */
export function settingsPage(view: View, settings: Settings, to: string, { notice = "", error = "" } = {}): string {
	return layout(
		view,
		`${notice ? `<p>${esc(notice)}</p>` : ""}${error ? `<p class="bad">${esc(error)}</p>` : ""}
<form method="post" action="/settings">
<h1>Appearance</h1>
<div class="fields">
	${row("theme", "Theme", select("theme", THEMES.map((t) => [t, NAMES[t]]), settings.theme))}
	${row("font", "Typeface", select("font", FONTS.map((f) => [f, NAMES[f]]), settings.font))}
	${row("size", "Text size", select("size", SIZES.map((s) => [s, `${s}px`]), settings.size))}
	${row("accent", "Accent", input("accent", settings.accent, 7, "#1a5fb4"))}
	${hint("A colour for links and the Send button. Empty uses the text colour.")}
</div>
<h1>Writing</h1>
<div class="fields">
	${row("greeting", "Greeting", input("greeting", settings.greeting, 200))}
	${row("prefix", "Subject starts with", input("prefix", settings.prefix, 100))}
	${row("deliverIn", "Deliver in", select("deliverIn", DELIVERY_CHOICES, settings.deliverIn))}
	${row("prompts", "Prompts", `<textarea id="prompts" name="prompts">${esc(settings.prompts.join("\n"))}</textarea>`)}
	${hint("One per line, up to 20.")}
	${row("css", "Custom CSS", `<textarea id="css" name="css" spellcheck="false">${esc(settings.css)}</textarea>`)}
	${hint("Added after the built-in styles on every page except this one.")}
</div>
<p><button class="primary">Save</button></p>
</form>
<h1>Account</h1>
<form method="post" action="/settings/test"><button>Send a test email</button> <span class="small">to ${esc(to)}</span></form>
<p><a href="/export">Download every letter</a> <span class="small">as JSON. Sealed letters are included in plain text, so keep the file somewhere private.</span></p>`,
		{ customCss: false },
	);
}

function row(name: string, label: string, control: string): string {
	return `<label for="${name}">${label}</label>${control}`;
}

function hint(text: string): string {
	return `<span></span><span class="small">${text}</span>`;
}

function input(name: string, value: string, maxlength: number, placeholder = ""): string {
	return `<input type="text" id="${name}" name="${name}" maxlength="${maxlength}" value="${esc(value)}"${placeholder ? ` placeholder="${placeholder}"` : ""}>`;
}

function select(name: string, options: [string | number, string][], current: string | number): string {
	const opts = options.map(([value, label]) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`).join("");
	return `<select id="${name}" name="${name}">${opts}</select>`;
}
