import { html, redirect, type Ctx } from "../http";
import { settingsPage } from "../pages/settings";
import { readSettings } from "../settings";

export async function settingsForm(c: Ctx): Promise<Response> {
	const notice = c.url.searchParams.has("saved") ? "Saved." : "";
	return html(c, settingsPage(c.view, c.view.settings, { notice }));
}

export async function saveSettings(c: Ctx): Promise<Response> {
	const { settings, error } = readSettings(await c.req.formData());
	if (error) return html(c, settingsPage(c.view, settings, { error }), 400);
	await c.store.saveSettings(settings);
	return redirect("/settings?saved");
}
