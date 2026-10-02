import { field, html, redirect, type Ctx } from "../http";
import type { LetterInput } from "../letters";
import { letterPage, lettersPage } from "../pages/letters";
import { DELIVERY_CHOICES, newDraft, writePage, type Draft } from "../pages/write";
import { DAY, now, safeTimeZone } from "../time";

const MAX_YEARS_AHEAD = 100;

export async function writeForm(c: Ctx): Promise<Response> {
	const today = new Date().toLocaleDateString("en-US", { dateStyle: "medium" });
	return html(writePage(c.env.OWNER_EMAIL, newDraft(today)));
}

export async function createLetter(c: Ctx): Promise<Response> {
	const { draft, input, error } = readDraft(await c.req.formData());
	if (!input) return html(writePage(c.env.OWNER_EMAIL, draft, error), 400);
	const id = await c.store.addLetter(input);
	return redirect(`/letters?sent=${id}`);
}

export async function listLetters(c: Ctx): Promise<Response> {
	return html(lettersPage(await c.store.listLetters(), c.url.searchParams.get("sent") ?? ""));
}

export async function readLetter(c: Ctx): Promise<Response> {
	const letter = await c.store.readLetter(c.params[0]);
	return letter ? html(letterPage(letter)) : redirect("/letters");
}

/**
 * Validates the write form. The browser sends `deliver_at` as 9:00 local time on the chosen date; without JavaScript the date, or the "Deliver in" choice, is taken at 9:00 UTC.
 * Returns the draft to refill the form with, and either a letter ready to store or an error message.
 */
function readDraft(form: FormData): { draft: Draft; input?: LetterInput; error?: string } {
	const months = Number(field(form, "in"));
	const draft: Draft = {
		subject: field(form, "subject").trim(),
		body: field(form, "body"),
		date: field(form, "date"),
		months: DELIVERY_CHOICES.some(([m]) => m === months) ? months : 0,
	};
	const deliverAt = Number(field(form, "deliver_at")) || utcNineAm(draft);
	const t = now();

	if (!draft.subject || draft.subject.length > 200) return { draft, error: "Give the letter a subject of up to 200 characters." };
	if (!draft.body.trim() || draft.body.length > 100_000) return { draft, error: "Write a letter of up to 100,000 characters." };
	if (!Number.isInteger(deliverAt) || deliverAt <= t) return { draft, error: "Pick a date in the future." };
	if (deliverAt > t + MAX_YEARS_AHEAD * 365 * DAY) return { draft, error: `Pick a date within ${MAX_YEARS_AHEAD} years.` };
	return { draft, input: { subject: draft.subject, body: draft.body, deliverAt, tz: safeTimeZone(field(form, "tz") || "UTC") } };
}

/** 9:00 UTC on the picked date, or that many months from today when only a "Deliver in" choice was made. NaN when neither was given. */
function utcNineAm(draft: Draft): number {
	if (draft.date) return Date.parse(`${draft.date}T09:00:00Z`) / 1000;
	if (!draft.months) return NaN;
	const d = new Date();
	d.setUTCMonth(d.getUTCMonth() + draft.months);
	d.setUTCHours(9, 0, 0, 0);
	return d.getTime() / 1000;
}
