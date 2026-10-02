import { configProblems, isOwner, smtpConfig } from "../env";
import { type Ctx, field, html, type OwnerCtx, redirect, setSession } from "../http";
import { errorText, sendOne } from "../mail";
import { confirmPage, signInPage } from "../pages/signin";

/**
 * Emails a sign-in link when the address is the owner's. Any other address gets the same check-your-inbox page and no email.
 * For the owner, making the link and sending the email both happen after the response, and a failure only goes to the Worker's logs, so every address gets the same page, status and timing.
 */
export async function signIn(c: Ctx): Promise<Response> {
	const problems = configProblems(c.env);
	if (problems.length)
		return html(c, signInPage(c.view, { error: `This Someday is not set up yet. ${problems.join(" ")} Fix it in the Worker's Variables and Secrets.` }), 503);

	const email = field(await c.req.formData(), "email");
	if (isOwner(c.env, email)) c.waitUntil(sendLink(c).catch((e) => console.error(`Sign-in email failed: ${errorText(e)}`)));
	return html(c, signInPage(c.view, { sent: true }));
}

/** Makes a link and emails it, unless one was made in the last minute or ten today. A failed send still counts toward that limit, so a stranger cannot make the Worker retry the owner's SMTP login without end. */
async function sendLink(c: Ctx): Promise<void> {
	const link = await c.store.createLink();
	if (!link) return;
	await sendOne(smtpConfig(c.env), {
		to: c.env.OWNER_EMAIL.trim(),
		subject: "Your Someday sign-in link",
		text: `Open this link to sign in to Someday:\n\n${c.url.origin}/auth?t=${link}\n\nIt works once, for 15 minutes. If you did not ask for it, ignore this email.\n`,
	});
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
