import { esc, layout } from "./layout";

/** The page a signed-out visitor sees. `sent` replaces the form with a check-your-inbox message. */
export function signInPage({ sent = false, error = "" } = {}): string {
	const form = sent
		? `<div class="card"><p>Check your inbox. If that is this Someday's owner address, a sign-in link is on its way. It works once, for 15 minutes.</p></div>`
		: `<form class="card" method="post" action="/signin">
	<label for="email">This Someday belongs to one person. Enter their email address to get a sign-in link.</label>
	<input id="email" name="email" type="email" required autocomplete="email">
	${error ? `<p class="error">${esc(error)}</p>` : ""}
	<p><button>Email me a sign-in link</button></p>
</form>`;
	return layout(`<div class="narrow">
<h1>Write a letter to your future self</h1>
<p class="lede">Write it. Pick a date. Read it years from now.</p>
${form}
</div>`);
}

/** Shown when the sign-in link is opened. Signing in takes a button press, so mail scanners that open links do not use up the link. */
export function confirmPage(link: string): string {
	return layout(`<div class="narrow">
<h1>Welcome back</h1>
<form class="card" method="post" action="/auth">
	<input type="hidden" name="t" value="${esc(link)}">
	<button class="big">Sign in to Someday</button>
</form>
</div>`);
}
