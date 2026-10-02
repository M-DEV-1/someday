import type { View } from "../http";
import { type Html, html } from "./html";
import { layout } from "./layout";

/** The page a signed-out visitor sees. `sent` replaces the form with the line every address gets after submitting. */
export function signInPage(view: View, { sent = false, error = "" } = {}): Html {
	if (sent) return layout(view, html`<p>If that is the owner's address, a sign-in link is on its way. It works once, for 15 minutes.</p>`);
	return layout(
		view,
		html`<p>Someday keeps letters to your future self and emails them on the day. Sign in with the owner's address.</p>
<form class="inline" method="post" action="/signin">
	<input name="email" type="email" aria-label="Email address" required autocomplete="email">
	<button>Send link</button>
</form>
${error && html`<p class="bad">${error}</p>`}`,
	);
}

/** Shown when the sign-in link is opened. Signing in takes a button press, so mail scanners that open links do not use up the link. */
export function confirmPage(view: View, link: string): Html {
	return layout(
		view,
		html`<form method="post" action="/auth">
	<p>Sign in to Someday.</p>
	<input type="hidden" name="t" value="${link}">
	<button class="primary">Sign in</button>
</form>`,
	);
}
