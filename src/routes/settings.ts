import { configProblems, smtpConfig } from "../env";
import { html, type OwnerCtx, redirect } from "../http";
import { errorText, sendOne } from "../mail";
import { settingsPage } from "../pages/settings";
import { readSettings } from "../settings";

export async function settingsForm(c: OwnerCtx): Promise<Response> {
	const q = c.url.searchParams;
	const notice = q.has("saved") ? "Saved." : q.has("tested") ? `Test email sent to ${c.env.OWNER_EMAIL.trim()}.` : "";
	return html(c, settingsPage(c.view, c.view.settings, c.env.OWNER_EMAIL, { notice }));
}

export async function saveSettings(c: OwnerCtx): Promise<Response> {
	const { settings, error } = readSettings(await c.req.formData());
	if (error) return html(c, settingsPage(c.view, settings, c.env.OWNER_EMAIL, { error }), 400);
	await c.store.saveSettings(settings);
	return redirect("/settings?saved");
}

/** Sends a one-line email through the same SMTP settings letters use, and shows the server's reply if it fails. */
export async function sendTest(c: OwnerCtx): Promise<Response> {
	const fail = (error: string) => html(c, settingsPage(c.view, c.view.settings, c.env.OWNER_EMAIL, { error }), 502);
	const problems = configProblems(c.env);
	if (problems.length) return fail(`Not set up: ${problems.join(" ")}`);
	try {
		await sendOne(smtpConfig(c.env), {
			to: c.env.OWNER_EMAIL.trim(),
			subject: "Someday test email",
			text: "This is a test email from your Someday. Letters arrive the same way.\n",
		});
	} catch (e) {
		return fail(`The test email could not be sent. ${errorText(e)}`);
	}
	return redirect("/settings?tested");
}
