import { backupFilename } from "../backup";
import { html, type OwnerCtx, redirect } from "../http";
import { settingsPage } from "../pages/settings";

/** Downloads a backup: the settings and every letter, sealed ones included, so the owner keeps a copy that does not depend on Cloudflare. */
export async function downloadBackup(c: OwnerCtx): Promise<Response> {
	return new Response(await c.store.backupFile(), {
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
	const body = c.req.body;
	const result = body ? await c.store.restoreUpload(body, c.req.headers.get("Content-Type") ?? "") : { error: "Choose a backup file to restore." };
	if ("error" in result) return html(c, settingsPage(c.view, c.view.settings, c.env.OWNER_EMAIL, { error: result.error }), 400);
	return redirect(`/settings?restored=${result.added}&skipped=${result.skipped}`);
}
