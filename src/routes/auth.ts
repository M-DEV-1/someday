import { configProblems, isOwner, smtpConfig } from "../env";
import { type Ctx, field, html, type OwnerCtx, redirect, setSession } from "../http";
import { errorText, sendOne } from "../mail";
import { confirmPage, signInPage } from "../pages/signin";

/** Emails a sign-in link when the address is the owner's. Any other address gets the same check-your-inbox page and no email. */
export async function signIn(c: Ctx): Promise<Response> {
	const problems = configProblems(c.env);
	if (problems.length)
		return html(c, signInPage(c.view, { error: `This Someday is not set up yet. ${problems.join(" ")} Fix it in the Worker's Variables and Secrets.` }), 503);

	const email = field(await c.req.formData(), "email");
	if (!isOwner(c.env, email)) return html(c, signInPage(c.view, { sent: true }));

	// Over the limit looks the same as a stranger's address, so the limit does not confirm which address is the owner's.
	const link = await c.store.createLink();
	if (!link) return html(c, signInPage(c.view, { sent: true }));

	try {
		await sendOne(smtpConfig(c.env), {
			to: c.env.OWNER_EMAIL.trim(),
			subject: "Your Someday sign-in link",
			text: `Open this link to sign in to Someday:\n\n${c.url.origin}/auth?t=${link}\n\nIt works once, for 15 minutes. If you did not ask for it, ignore this email.\n`,
		});
	} catch (e) {
		await c.store.discardLink(link);
		return html(c, signInPage(c.view, { error: `The sign-in email could not be sent. ${errorText(e)}` }), 502);
	}
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
