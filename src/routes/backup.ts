import { backupFilename, readBackup } from "../backup";
import { html, type OwnerCtx, redirect } from "../http";
import { settingsPage } from "../pages/settings";

/** Downloads a backup: the settings and every letter, sealed ones included, so the owner keeps a copy that does not depend on Cloudflare. */
export async function downloadBackup(c: OwnerCtx): Promise<Response> {
	return new Response(JSON.stringify(await c.store.backup(), null, "\t"), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="${backupFilename()}"`,
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/** Restores an uploaded backup file, then shows how many letters were added. */
export async function restoreBackup(c: OwnerCtx): Promise<Response> {
	const fail = (error: string) => html(c, settingsPage(c.view, c.view.settings, c.env.OWNER_EMAIL, { error }), 400);
	const file = (await c.req.formData()).get("file");
	if (!(file instanceof File) || file.size === 0) return fail("Choose a backup file to restore.");
	let raw: unknown;
	try {
		raw = JSON.parse(await file.text());
	} catch {
		return fail("That file is not a Someday backup.");
	}
	const read = readBackup(raw);
	if ("error" in read) return fail(read.error);
	const { added, skipped } = await c.store.restore(read.restore);
	return redirect(`/settings?restored=${added}&skipped=${skipped}`);
}
