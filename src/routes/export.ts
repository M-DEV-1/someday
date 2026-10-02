import type { OwnerCtx } from "../http";

/** Downloads every letter as JSON, sealed ones included, so the owner keeps a copy that does not depend on this Worker. */
export async function exportLetters(c: OwnerCtx): Promise<Response> {
	const iso = (ts: number | null) => (ts === null ? null : new Date(ts * 1000).toISOString());
	const letters = (await c.store.exportLetters()).map((l) => ({
		id: l.id,
		subject: l.subject,
		body: l.body,
		timeZone: l.tz,
		written: iso(l.createdAt),
		deliver: iso(l.deliverAt),
		delivered: iso(l.sentAt),
	}));
	const today = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(letters, null, "\t"), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="someday-letters-${today}.json"`,
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
