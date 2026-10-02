import { esc, layout } from "./layout";

export interface Draft {
	subject: string;
	body: string;
	/** YYYY-MM-DD picked in the date field, or empty. */
	date: string;
	/** Months from the "Deliver in" choice, or 0 when a date was picked instead. */
	months: number;
}

export const DELIVERY_CHOICES: [months: number, label: string][] = [
	[6, "6 months"],
	[12, "1 year"],
	[36, "3 years"],
	[60, "5 years"],
	[120, "10 years"],
];

export function newDraft(today: string): Draft {
	return { subject: `A letter from ${today}`, body: "Dear future me,\n\n", date: "", months: 6 };
}

/** The write form: the letter on the left, delivery options on the right. `to` is the owner's address the letter will go to. */
export function writePage(to: string, draft: Draft, error = ""): string {
	const chips = DELIVERY_CHOICES.map(
		([months, label]) =>
			`<input type="radio" name="in" id="in${months}" value="${months}"${draft.months === months ? " checked" : ""}><label for="in${months}">${label}</label>`,
	).join("");
	return layout(
		`<h1>Write a letter to your future self</h1>
<p class="lede">Write it. Pick a date. Send it. Someday keeps it sealed until then.</p>
<form class="write" method="post" action="/letters" id="write">
	<div class="paper">
		<input class="subject" name="subject" aria-label="Subject" maxlength="200" required value="${esc(draft.subject)}">
		<textarea name="body" aria-label="Letter" maxlength="100000" required>${esc(draft.body)}</textarea>
	</div>
	<aside>
		<div><label>Deliver in</label><div class="chips">${chips}</div></div>
		<div><label for="date">Or choose a date</label><input type="date" id="date" name="date" value="${esc(draft.date)}"></div>
		<p class="muted">It arrives at 9:00 on <strong id="when">the date you pick</strong>, sent to ${esc(to)}.</p>
		${error ? `<p class="error">${esc(error)}</p>` : ""}
		<input type="hidden" name="deliver_at"><input type="hidden" name="tz">
		<button class="big">Send to the future</button>
	</aside>
</form>
<script>
const f = document.getElementById("write");
const when = document.getElementById("when");
const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const deliverAt = () => new Date(f.date.value + "T09:00");
function show() {
	when.textContent = f.date.value ? deliverAt().toLocaleDateString(undefined, { dateStyle: "long" }) : "the date you pick";
}
function fromChoice() {
	const picked = f.querySelector("input[name=in]:checked");
	if (!picked) return;
	const d = new Date();
	d.setMonth(d.getMonth() + Number(picked.value));
	f.date.value = localDate(d);
	show();
}
f.date.min = localDate(new Date(Date.now() + 864e5));
f.addEventListener("change", (e) => {
	if (e.target.name === "in") fromChoice();
	if (e.target.name === "date") { for (const r of f.querySelectorAll("input[name=in]")) r.checked = false; show(); }
});
f.addEventListener("submit", () => {
	f.deliver_at.value = f.date.value ? Math.floor(deliverAt().getTime() / 1000) : "";
	f.tz.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
});
if (f.date.value) show(); else fromChoice();
</script>`,
		true,
	);
}
