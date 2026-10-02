// The write page. Keeps the "Deliver in" choice and the date field in step, says when the letter will arrive, and on submit sends the delivery time as 9:00 on the chosen date in the writer's own time zone.
import { byId, control } from "./dom";

const form = byId("write", HTMLFormElement);
const when = byId("when", HTMLElement);
const subject = control(form, "subject", HTMLInputElement);
const months = control(form, "in", HTMLSelectElement);
const date = control(form, "date", HTMLInputElement);
const deliverAt = control(form, "deliver_at", HTMLInputElement);
const tz = control(form, "tz", HTMLInputElement);

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const medium = (d: Date) => d.toLocaleDateString("en-US", { dateStyle: "medium" });
const nineAm = () => new Date(`${date.value}T09:00`);

function show(): void {
	if (date.value) when.textContent = `Arrives 9:00, ${medium(nineAm())}, at ${when.dataset["to"] ?? "your address"}.`;
}

/** Sets the date from the "Deliver in" choice, keeping the day of the month where it exists (Aug 31 plus 6 months is Feb 28 or 29). */
function fromChoice(): void {
	const n = Number(months.value);
	if (!n) return;
	const d = new Date();
	const day = d.getDate();
	d.setDate(1);
	d.setMonth(d.getMonth() + n);
	d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
	date.value = localDate(d);
	show();
}

date.min = localDate(new Date(Date.now() + 864e5));
months.addEventListener("change", fromChoice);
date.addEventListener("change", () => {
	months.value = "0";
	show();
});
form.addEventListener("submit", () => {
	deliverAt.value = date.value ? String(Math.floor(nineAm().getTime() / 1000)) : "";
	tz.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
});

// The server only knows the UTC date, so a new draft's subject gets the writer's local date.
const prefix = subject.dataset["prefix"];
if (prefix !== undefined) subject.value = [prefix, medium(new Date())].filter(Boolean).join(" ");
if (date.value) show();
else fromChoice();
