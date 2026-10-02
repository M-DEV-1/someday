import type { View } from "../http";
import type { Letter, LetterSummary } from "../letters";
import { formatDate, fromNow } from "../time";
import { esc, layout } from "./layout";

/** The owner's letters: sealed ones by arrival date, then delivered ones, newest first. `justSent` is the ID of a letter written a moment ago. */
export function lettersPage(view: View, letters: LetterSummary[], justSent = ""): string {
	const sealed = letters.filter((l) => !l.sentAt);
	const delivered = letters.filter((l) => l.sentAt).reverse();
	const sent = sealed.find((l) => l.id === justSent);
	return layout(
		view,
		`${sent ? `<p>Sealed. Arrives ${formatDate(sent.deliverAt, sent.tz)}, ${fromNow(sent.deliverAt)}.</p>` : ""}
<h1>Sealed</h1>
${list(sealed.map(sealedRow))}
<h1>Delivered</h1>
${list(delivered.map(deliveredRow))}
${confirmDeletes(view)}`,
	);
}

/** A delivered letter, opened in full. */
export function letterPage(view: View, letter: Letter): string {
	return layout(
		view,
		`<div class="reading">
<p class="muted"><a href="/letters">My letters</a></p>
<h2>${esc(letter.subject)}</h2>
<p class="muted">Written ${formatDate(letter.createdAt, letter.tz)} · delivered ${formatDate(letter.sentAt!, letter.tz)}</p>
<div class="letter-body">${esc(letter.body)}</div>
${deleteForm(letter.id)}
</div>
${confirmDeletes(view)}`,
	);
}

function list(rows: string[]): string {
	return rows.length ? `<ul class="letters">${rows.join("")}</ul>` : `<p class="small">None.</p>`;
}

/** Date, subject and a delete link. A letter that failed to send gets the server's reply on a second line. */
function sealedRow(l: LetterSummary): string {
	const failed = l.attempts
		? `<span class="bad small">Could not send, ${l.attempts} ${l.attempts === 1 ? "try" : "tries"}, retrying: ${esc(l.lastError ?? "")}</span>`
		: "";
	return `<li><time>${formatDate(l.deliverAt, l.tz)}</time><span>${esc(l.subject)}</span>${deleteForm(l.id, "delete")}${failed}</li>`;
}

function deliveredRow(l: LetterSummary): string {
	return `<li><time>${formatDate(l.sentAt!, l.tz)}</time><a href="/letters/${l.id}">${esc(l.subject)}</a><span></span></li>`;
}

function deleteForm(id: string, label = "Delete this letter"): string {
	return `<form class="delete" method="post" action="/letters/delete"><input type="hidden" name="id" value="${esc(id)}"><button class="link small">${label}</button></form>`;
}

/** Asks before a delete form submits. It is a nonce'd script because the policy blocks inline onsubmit handlers. */
function confirmDeletes(view: View): string {
	return `<script nonce="${view.nonce}">
for (const f of document.querySelectorAll("form.delete")) f.addEventListener("submit", (e) => { if (!confirm("Delete this letter for good?")) e.preventDefault(); });
</script>`;
}
