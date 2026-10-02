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

// One formatter per time zone, kept for the life of the isolate. Building formatters for each row took about 70 ms for 1,000 letters in V8; reusing one takes about 1 ms, which keeps the letters page inside the free plan's 10 ms of CPU per request.
const formats = new Map<string, Intl.DateTimeFormat>();

/** Formats Unix seconds as a date like "Oct 2, 2031" in the given time zone. */
export function formatDate(ts: number, tz: string): string {
	let format = formats.get(tz);
	if (!format) {
		format = new Intl.DateTimeFormat("en-US", { timeZone: safeTimeZone(tz), dateStyle: "medium" });
		formats.set(tz, format);
	}
	return format.format(new Date(ts * 1000));
}

/** Describes how far `ts` is from now in the largest whole unit, e.g. "in 5 years", "in 3 months", "in 12 days". */
export function fromNow(ts: number): string {
	const days = Math.round((ts - now()) / DAY);
	if (days <= 0) return "today";
	if (days === 1) return "tomorrow";
	const [n, unit] = days >= 365 ? [Math.floor(days / 365), "year"] : days >= 60 ? [Math.floor(days / 30), "month"] : [days, "day"];
	return `in ${n} ${unit}${n === 1 ? "" : "s"}`;
}
