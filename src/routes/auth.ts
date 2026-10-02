import { isOwner, missingConfig, smtpConfig } from "../env";
import { field, html, redirect, setSession, type Ctx } from "../http";
import { sendOne } from "../mail";
import { confirmPage, signInPage } from "../pages/signin";

/** Emails a sign-in link when the address is the owner's. Any other address gets the same check-your-inbox page and no email. */
export async function signIn(c: Ctx): Promise<Response> {
	const missing = missingConfig(c.env);
	if (missing.length) return html(signInPage({ error: `This Someday is not set up yet. Set ${missing.join(", ")} in the Worker's settings.` }), 503);

	const email = field(await c.req.formData(), "email");
	if (!isOwner(c.env, email)) return html(signInPage({ sent: true }));

	const link = await c.store.createLink();
	if (!link) return html(signInPage({ error: "A link was sent a moment ago. Check your inbox, or try again in a minute." }), 429);

	try {
		await sendOne(smtpConfig(c.env), {
			to: c.env.OWNER_EMAIL.trim(),
			subject: "Your Someday sign-in link",
			text: `Open this link to sign in to Someday:\n\n${c.url.origin}/auth?t=${link}\n\nIt works once, for 15 minutes. If you did not ask for it, ignore this email.\n`,
		});
	} catch (e) {
		return html(signInPage({ error: `The sign-in email could not be sent. ${(e as Error).message}` }), 502);
	}
	return html(signInPage({ sent: true }));
}

export async function confirmLink(c: Ctx): Promise<Response> {
	return html(confirmPage(c.url.searchParams.get("t") ?? ""));
}

export async function redeemLink(c: Ctx): Promise<Response> {
	const session = await c.store.redeemLink(field(await c.req.formData(), "t"));
	if (!session) return html(signInPage({ error: "That sign-in link has expired or was already used. Ask for a new one." }), 401);
	return setSession(redirect("/"), session);
}

export async function signOut(c: Ctx): Promise<Response> {
	await c.store.signOut(c.session!);
	return setSession(redirect("/"), null);
}
