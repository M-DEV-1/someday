import type { LetterSummary } from "../letters";
import { formatDate, fromNow } from "../time";
import { esc, layout } from "./layout";

/** The owner's letters: sealed upcoming ones, then delivered ones. `justSent` is the ID of a letter written a moment ago. */
export function lettersPage(letters: LetterSummary[], justSent = ""): string {
	const upcoming = letters.filter((l) => !l.sentAt);
	const delivered = letters.filter((l) => l.sentAt).reverse();
	const sent = upcoming.find((l) => l.id === justSent);
	const notice = sent ? `<p class="notice">Sealed and on its way. It arrives on ${formatDate(sent.deliverAt, sent.tz)}, ${fromNow(sent.deliverAt)}.</p>` : "";

	if (!letters.length) {
		return layout(`<h2>My letters</h2><p class="lede">No letters yet. <a href="/">Write your first one.</a></p>`, true);
	}
	return layout(
		`${notice}<h2>My letters</h2>
<h3>Upcoming (${upcoming.length}) · sealed until they arrive</h3>
<ul class="letters">${upcoming.map(upcomingRow).join("") || `<li class="muted">Nothing on its way. <a href="/">Write one.</a></li>`}</ul>
<h3>Delivered (${delivered.length})</h3>
<ul class="letters">${delivered.map(deliveredRow).join("") || `<li class="muted">None yet.</li>`}</ul>`,
		true,
	);
}

function upcomingRow(l: LetterSummary): string {
	const state = l.attempts
		? `<span class="error" title="${esc(l.lastError ?? "")}">Could not send (${l.attempts} ${l.attempts === 1 ? "try" : "tries"}), retrying: ${esc(l.lastError ?? "")}</span>`
		: `Arrives ${formatDate(l.deliverAt, l.tz)}, ${fromNow(l.deliverAt)}`;
	return `<li><span>${esc(l.subject)}</span><span class="muted">${state}</span></li>`;
}

function deliveredRow(l: LetterSummary): string {
	return `<li><span>${esc(l.subject)}</span><span class="muted">Delivered ${formatDate(l.sentAt!, l.tz)}</span></li>`;
}
