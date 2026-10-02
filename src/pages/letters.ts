import type { View } from "../http";
import { isDelivered, type Delivered, type Letter, type LetterSummary } from "../letters";
import { formatDate, fromNow } from "../time";
import { html, type Html } from "./html";
import { layout } from "./layout";

/** The owner's letters: sealed ones by arrival date, then delivered ones, newest first. `justSent` is the ID of a letter written a moment ago. */
export function lettersPage(view: View, letters: LetterSummary[], justSent = ""): Html {
	const sealed = letters.filter((l) => !isDelivered(l));
	const delivered = letters.filter(isDelivered).reverse();
	const sent = sealed.find((l) => l.id === justSent);
	return layout(
		view,
		html`${sent && html`<p>Sealed. Arrives ${formatDate(sent.deliverAt, sent.tz)}, ${fromNow(sent.deliverAt)}.</p>`}
<h1>Sealed</h1>
${list(sealed.map(sealedRow))}
<h1>Delivered</h1>
${list(delivered.map(deliveredRow))}
${confirmDeletes(view)}`,
	);
}

/** A delivered letter, opened in full. */
export function letterPage(view: View, letter: Delivered<Letter>): Html {
	return layout(
		view,
		html`<p class="small">Written ${formatDate(letter.createdAt, letter.tz)}. Delivered ${formatDate(letter.sentAt, letter.tz)}.</p>
<h1>${letter.subject}</h1>
<div class="body">${letter.body}</div>
${deleteForm(letter.id)}
${confirmDeletes(view)}`,
	);
}

function list(rows: Html[]): Html {
	return rows.length ? html`<ul class="letters">${rows}</ul>` : html`<p class="small">None.</p>`;
}

/** Date, subject and a delete link. A letter that failed to send gets the server's reply on a second line. */
function sealedRow(l: LetterSummary): Html {
	const failed = l.attempts > 0 && html`<span class="bad small">Could not send, ${l.attempts} ${l.attempts === 1 ? "try" : "tries"}, retrying: ${l.lastError ?? ""}</span>`;
	return html`<li><time>${formatDate(l.deliverAt, l.tz)}</time><span>${l.subject}</span>${deleteForm(l.id, "delete")}${failed}</li>`;
}

function deliveredRow(l: Delivered<LetterSummary>): Html {
	return html`<li><time>${formatDate(l.sentAt, l.tz)}</time><a href="/letters/${l.id}">${l.subject}</a><span></span></li>`;
}

function deleteForm(id: string, label = "Delete this letter"): Html {
	return html`<form class="delete" method="post" action="/letters/delete"><input type="hidden" name="id" value="${id}"><button class="link small">${label}</button></form>`;
}

/** Asks before a delete form submits. It is a nonce'd script because the policy blocks inline onsubmit handlers. */
function confirmDeletes(view: View): Html {
	return html`<script nonce="${view.nonce}">
for (const f of document.querySelectorAll("form.delete")) f.addEventListener("submit", (e) => { if (!confirm("Delete this letter for good?")) e.preventDefault(); });
</script>`;
}
