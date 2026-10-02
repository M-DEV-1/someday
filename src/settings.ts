import { field } from "./http";

export const DELIVERY_CHOICES: [months: number, label: string][] = [
	[6, "6 months"],
	[12, "1 year"],
	[36, "3 years"],
	[60, "5 years"],
	[120, "10 years"],
];

export const THEMES = ["auto", "light", "dark"] as const;
export const FONTS = ["serif", "sans", "mono"] as const;
export const SIZES = [16, 18, 20, 22] as const;

/** The owner's choices for how Someday looks and what a new letter starts with. */
export interface Settings {
	theme: (typeof THEMES)[number];
	font: (typeof FONTS)[number];
	/** Text size in pixels. */
	size: number;
	/** A colour like #1a5fb4 for links, focus rings and the send button, or empty for the text colour. */
	accent: string;
	greeting: string;
	/** The start of a new letter's subject; today's date follows it. */
	prefix: string;
	/** Months a new letter is set to arrive in. */
	deliverIn: number;
	prompts: string[];
	/** Added after the built-in styles on every page except Settings. */
	css: string;
}

export const DEFAULTS: Settings = {
	theme: "auto",
	font: "serif",
	size: 18,
	accent: "",
	greeting: "Dear future me,",
	prefix: "A letter from",
	deliverIn: 6,
	prompts: [
		"What are you worried about right now that you hope turned out fine?",
		"What does an ordinary day look like for you at the moment?",
		"Who do you spend most of your time with?",
		"What are you trying to get better at?",
		"What habit do you hope you have dropped by now?",
		"What would you like to be proud of when you read this?",
		"What are you reading, watching or listening to these days?",
		"What would you tell yourself on a hard day?",
		"What small thing made you happy this week?",
		"What do you think will have changed the most?",
		"What decision are you weighing right now?",
		"What do you want to remember about this year?",
	],
	css: "",
};

/** The settings row. It is stored as one JSON object and read over the defaults, so settings added in later versions start at their default. */
export class SettingsStore {
	constructor(private sql: SqlStorage) {
		sql.exec("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL)");
	}

	get(): Settings {
		const row = this.sql.exec<{ json: string }>("SELECT json FROM settings").toArray()[0];
		return row ? { ...DEFAULTS, ...JSON.parse(row.json) } : DEFAULTS;
	}

	save(settings: Settings): void {
		this.sql.exec("INSERT OR REPLACE INTO settings (id, json) VALUES (1, ?)", JSON.stringify(settings));
	}
}

/** Reads the settings form. Unknown choices fall back to the default; text that is too long or a malformed colour returns an error naming the field. */
export function readSettings(form: FormData): { settings: Settings; error?: string } {
	const pick = <T>(value: T, allowed: readonly T[], fallback: T): T => (allowed.includes(value) ? value : fallback);
	const settings: Settings = {
		theme: pick(field(form, "theme") as Settings["theme"], THEMES, DEFAULTS.theme),
		font: pick(field(form, "font") as Settings["font"], FONTS, DEFAULTS.font),
		size: pick(Number(field(form, "size")), SIZES, DEFAULTS.size),
		accent: field(form, "accent").trim(),
		greeting: field(form, "greeting").trim(),
		prefix: field(form, "prefix").trim(),
		deliverIn: pick(Number(field(form, "deliverIn")), DELIVERY_CHOICES.map(([m]) => m), DEFAULTS.deliverIn),
		prompts: field(form, "prompts").split("\n").map((p) => p.trim()).filter(Boolean),
		css: field(form, "css"),
	};
	const error =
		settings.accent && !/^#[0-9a-f]{6}$/i.test(settings.accent) ? "Accent must be a colour like #1a5fb4, or empty."
		: settings.greeting.length > 200 ? "Greeting can be up to 200 characters."
		: settings.prefix.length > 100 ? "Subject start can be up to 100 characters."
		: settings.prompts.length > 20 || settings.prompts.some((p) => p.length > 200) ? "Prompts: up to 20, of up to 200 characters each."
		: settings.css.length > 20_000 ? "Custom CSS can be up to 20,000 characters."
		: undefined;
	return { settings, error };
}
