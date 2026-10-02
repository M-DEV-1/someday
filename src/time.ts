export const DAY = 86400;

/** Current time in Unix seconds. */
export function now(): number {
	return Math.floor(Date.now() / 1000);
}
