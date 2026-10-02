import { configProblems, isOwner, smtpConfig } from "../env";
import { type Ctx, field, html, type OwnerCtx, redirect, setSession } from "../http";
import { errorText, sendOne } from "../mail";
import { confirmPage, signInPage } from "../pages/signin";

/**
 * Emails a sign-in link when the address is the owner's. Any other address gets the same check-your-inbox page and no email.
 * The email is sent after the response, and a failed send only goes to the Worker's logs, so the page, its status and its timing are the same for every address.
 */
export async function signIn(c: Ctx): Promise<Response> {
	const problems = configProblems(c.env);
	if (problems.length)
		return html(c, signInPage(c.view, { error: `This Someday is not set up yet. ${problems.join(" ")} Fix it in the Worker's Variables and Secrets.` }), 503);

	const email = field(await c.req.formData(), "email");
	if (!isOwner(c.env, email)) return html(c, signInPage(c.view, { sent: true }));

	// Over the limit looks the same as a stranger's address, so the limit does not confirm which address is the owner's.
	const link = await c.store.createLink();
	if (!link) return html(c, signInPage(c.view, { sent: true }));

	// A failed send still counts toward the limit, so a stranger cannot make the Worker retry the owner's SMTP login without end.
	const mail = {
		to: c.env.OWNER_EMAIL.trim(),
		subject: "Your Someday sign-in link",
		text: `Open this link to sign in to Someday:\n\n${c.url.origin}/auth?t=${link}\n\nIt works once, for 15 minutes. If you did not ask for it, ignore this email.\n`,
	};
	c.waitUntil(sendOne(smtpConfig(c.env), mail).catch((e) => console.error(`Sign-in email failed: ${errorText(e)}`)));
	return html(c, signInPage(c.view, { sent: true }));
}

export async function confirmLink(c: Ctx): Promise<Response> {
	return html(c, confirmPage(c.view, c.url.searchParams.get("t") ?? ""));
}

export async function redeemLink(c: Ctx): Promise<Response> {
	const session = await c.store.redeemLink(field(await c.req.formData(), "t"));
	if (!session) return html(c, signInPage(c.view, { error: "That sign-in link has expired or was already used. Ask for a new one." }), 401);
	return setSession(redirect("/"), session);
}

export async function signOut(c: OwnerCtx): Promise<Response> {
	await c.store.signOut(c.session);
	return setSession(redirect("/"), null);
}

/** Ends every session, for a lost or shared device. */
export async function signOutEverywhere(c: OwnerCtx): Promise<Response> {
	await c.store.signOutEverywhere();
	return setSession(redirect("/"), null);
}
