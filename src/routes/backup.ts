import { backupFilename } from "../backup";
import type { OwnerCtx } from "../http";

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
