import type { View } from "../http";
import { DELIVERY_CHOICES, type Settings } from "../settings";
import { type Html, html } from "./html";
import { layout } from "./layout";

export interface Draft {
	subject: string;
	body: string;
	/** YYYY-MM-DD picked in the date field, or empty. */
	date: string;
	/** Months from the "Deliver in" choice, or 0 when a date was picked instead. */
	months: number;
}

/** A new letter from the owner's settings: the subject start and today's date, the greeting, and the default delivery. */
export function newDraft(settings: Settings, today: string): Draft {
	return {
		subject: [settings.prefix, today].filter(Boolean).join(" "),
		body: settings.greeting ? `${settings.greeting}\n\n` : "",
		date: "",
		months: settings.deliverIn,
	};
}

/**
 * The write page: subject, letter, and one line for when it arrives. `to` is the owner's address.
 * `fresh` marks a new draft, whose subject date the page script replaces with the writer's local date, since the server's date is UTC.
 */
export function writePage(view: View, to: string, draft: Draft, { error = "", fresh = false } = {}): Html {
	const choices: [number, string][] = [...DELIVERY_CHOICES, [0, "a date"]];
	const options = choices.map(([months, label]) => html`<option value="${months}"${draft.months === months && html` selected`}>${label}</option>`);
	const prompts = view.settings.prompts;
	return layout(
		view,
		html`<form method="post" action="/letters" id="write">
<p><input class="subject" type="text" name="subject" aria-label="Subject" maxlength="200" required value="${draft.subject}"${fresh && html` data-prefix="${view.settings.prefix}"`}></p>
<p><textarea name="body" aria-label="Letter" maxlength="100000" required>${draft.body}</textarea></p>
<p class="inline">Deliver in <select name="in" aria-label="Deliver in">${options}</select> or on <input type="date" name="date" aria-label="Date" value="${draft.date}"> <button class="primary">Send</button></p>
<p class="small" id="when" data-to="${to}">Arrives at 9:00 on the chosen date, at ${to}.</p>
${error && html`<p class="bad">${error}</p>`}
<input type="hidden" name="deliver_at"><input type="hidden" name="tz">
</form>
${prompts.length > 0 && html`<details><summary class="small">Prompts</summary><ul>${prompts.map((p) => html`<li>${p}</li>`)}</ul></details>`}
<script type="module" src="/js/write.js"></script>`,
	);
}
