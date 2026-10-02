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
		if (!row) return DEFAULTS;
		const raw: unknown = JSON.parse(row.json);
		return typeof raw === "object" && raw !== null ? checkSettings({ ...raw }).settings : DEFAULTS;
	}

	save(settings: Settings): void {
		this.sql.exec("INSERT OR REPLACE INTO settings (id, json) VALUES (1, ?)", JSON.stringify(settings));
	}
}

/** Reads the settings form. */
export function readSettings(form: FormData): { settings: Settings; error: string | undefined } {
	return checkSettings(Object.fromEntries([...form].filter((e): e is [string, string] => typeof e[1] === "string")));
}

/**
 * Checks settings from the form or the database. Input: any object; prompts may be an array or one string with a prompt per line.
 * Output: settings where a missing value or an unknown choice is replaced by the default, and an error naming the first field that is too long or a malformed colour.
 */
export function checkSettings(raw: Record<string, unknown>): { settings: Settings; error: string | undefined } {
	const text = (key: keyof Settings): string | undefined => {
		const v = raw[key];
		return typeof v === "string" ? v.trim() : undefined;
	};
	const choice = <T>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.find((a) => a === value) ?? fallback;
	const prompts = raw["prompts"];
	const settings: Settings = {
		theme: choice(raw["theme"], THEMES, DEFAULTS.theme),
		font: choice(raw["font"], FONTS, DEFAULTS.font),
		size: choice(Number(raw["size"]), SIZES, DEFAULTS.size),
		accent: text("accent") ?? DEFAULTS.accent,
		greeting: text("greeting") ?? DEFAULTS.greeting,
		prefix: text("prefix") ?? DEFAULTS.prefix,
		deliverIn: choice(Number(raw["deliverIn"]), DELIVERY_CHOICES.map(([m]) => m), DEFAULTS.deliverIn),
		prompts: (Array.isArray(prompts) ? prompts : typeof prompts === "string" ? prompts.split("\n") : DEFAULTS.prompts)
			.filter((p): p is string => typeof p === "string")
			.map((p) => p.trim())
			.filter(Boolean),
		css: typeof raw["css"] === "string" ? raw["css"] : DEFAULTS.css,
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
