export const DAY = 86400;

/** Current time in Unix seconds. */
export function now(): number {
	return Math.floor(Date.now() / 1000);
}

/** Returns `tz` if it is a time zone the runtime knows, otherwise "UTC". */
export function safeTimeZone(tz: string): string {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return tz;
	} catch {
		return "UTC";
	}
}

/** Formats Unix seconds as a date like "Oct 2, 2031" in the given time zone. */
export function formatDate(ts: number, tz: string): string {
	return new Date(ts * 1000).toLocaleDateString("en-US", { timeZone: safeTimeZone(tz), dateStyle: "medium" });
}
