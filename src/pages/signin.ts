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
