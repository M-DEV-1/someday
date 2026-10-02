// End-to-end test: runs `wrangler dev` on empty storage against a fake SMTP server and walks sign-in, writing, delivery, a failed delivery, deletion and sign-out.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFakeSmtp } from "./fake-smtp.mjs";

const PORT = 8799;
const SMTP_PORT = 2525;
const BASE = `http://localhost:${PORT}`;
const OWNER = "me@example.com";

const smtp = startFakeSmtp(SMTP_PORT);
const dir = mkdtempSync(join(tmpdir(), "someday-"));
const vars = { OWNER_EMAIL: OWNER, SMTP_HOST: `localhost:${SMTP_PORT}`, SMTP_USER: OWNER, SMTP_PASSWORD: "pw" };
const dev = spawn(
	"npx",
	["wrangler", "dev", "--port", String(PORT), "--persist-to", dir, "--test-scheduled", ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])],
	{ stdio: "ignore", detached: true },
);

let cookie = "";
const get = (path) => fetch(BASE + path, { headers: { Cookie: cookie }, redirect: "manual" });
const post = (path, fields) => fetch(BASE + path, { method: "POST", body: new URLSearchParams(fields), headers: { Cookie: cookie }, redirect: "manual" });
const text = async (path) => (await get(path)).text();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inSeconds = (s) => String(Math.floor(Date.now() / 1000) + s);

/** Triggers the cron handler and waits until `done()` holds, since the handler finishes in the background. */
async function runCron(done) {
	await get("/__scheduled?cron=*/5+*+*+*+*");
	for (let i = 0; i < 40 && !(await done()); i++) await sleep(250);
	assert.ok(await done(), "cron run did not finish");
}

try {
	for (let i = 0; ; i++) {
		try { await fetch(BASE); break; } catch { if (i > 80) throw new Error("wrangler dev did not start"); await sleep(500); }
	}

	// Signed out: only the sign-in page, and a stranger's address gets no mail.
	assert.equal((await get("/wp-login.php")).status, 404);
	const csp = (await get("/")).headers.get("content-security-policy");
	assert.match(csp, /script-src 'nonce-[^']+'/);
	assert.doesNotMatch(csp, /unsafe-inline/);
	assert.match(await text("/"), /Send link/);
	assert.equal((await get("/letters")).status, 303);
	assert.equal((await fetch(BASE + "/letters", { headers: { Cookie: "someday=junk" }, redirect: "manual" })).status, 303);
	assert.equal((await post("/letters", { subject: "x", body: "x", in: "12" })).status, 403);
	assert.match(await (await post("/signin", { email: "stranger@example.com" })).text(), /a sign-in link is on its way/);
	assert.equal(smtp.inbox.length, 0, "a stranger's address gets no mail");

	// The owner gets a one-time link; a second request within a minute looks the same but sends nothing.
	assert.equal((await post("/signin", { email: "ME@example.com" })).status, 200);
	assert.equal(smtp.inbox.length, 1);
	assert.equal(smtp.inbox[0].subject, "Your Someday sign-in link");
	const link = smtp.inbox[0].text.match(/\/auth\?t=([\w-]+)/)[1];
	assert.match(await (await post("/signin", { email: OWNER })).text(), /a sign-in link is on its way/);
	assert.equal(smtp.inbox.length, 1);

	// Opening the link only shows a button; pressing it signs in once.
	assert.match(await text(`/auth?t=${link}`), /Sign in to Someday/);
	const signedIn = await post("/auth", { t: link });
	assert.equal(signedIn.status, 303);
	cookie = signedIn.headers.get("set-cookie").split(";")[0];
	assert.equal((await post("/auth", { t: link })).status, 401, "a link works once");
	const crossSite = await fetch(BASE + "/signout", { method: "POST", headers: { Cookie: cookie, "Sec-Fetch-Site": "cross-site" }, redirect: "manual" });
	assert.equal(crossSite.status, 403, "a form post from another site is refused");

	// Writing: validation keeps the draft, the no-JavaScript "Deliver in" path works, and upcoming letters stay sealed.
	assert.match(await text("/"), /A letter from[\s\S]*Dear future me,[\s\S]*Send<\/button>[\s\S]*<summary class="small">Prompts/);
	const past = await post("/letters", { subject: "Old", body: "Keep this text", date: "2000-01-01" });
	assert.equal(past.status, 400);
	assert.match(await past.text(), /Keep this text[\s\S]*Pick a date in the future/);
	const yearAway = await post("/letters", { subject: "In a year", body: "Hi", in: "12" });
	assert.equal(yearAway.status, 303);
	assert.match(await text(yearAway.headers.get("location")), /Sealed\. Arrives .*, in 1 year\./);

	const soon = await post("/letters", { subject: "Héllo <future> ✉", body: "Dear me,\nstill here?", deliver_at: inSeconds(1), tz: "Asia/Kolkata" });
	const soonId = soon.headers.get("location").split("sent=")[1];
	assert.equal((await get(`/letters/${soonId}`)).status, 303, "an upcoming letter cannot be opened");

	// Delivery: the cron sends the due letter only, and it can then be read.
	await sleep(1500);
	await runCron(() => smtp.inbox.length === 2);
	const delivered = smtp.inbox[1];
	assert.equal(delivered.to, `<${OWNER}>`);
	assert.equal(delivered.subject, "Héllo <future> ✉");
	assert.match(delivered.text, /^Dear me,\nstill here\?\n\n--\nYou wrote this on /);
	assert.match(await text(`/letters/${soonId}`), /Héllo &#60;future&#62; ✉[\s\S]*Dear me,\nstill here\?/);
	assert.match(await text("/letters"), /Sealed<\/h1>[\s\S]*In a year[\s\S]*Delivered<\/h1>[\s\S]*Héllo/);

	// A failed send is shown on the letter and retried later instead of being dropped.
	smtp.rejectAuth = true;
	const failing = await post("/letters", { subject: "Will fail", body: "x", deliver_at: inSeconds(1), tz: "UTC" });
	const failingId = failing.headers.get("location").split("sent=")[1];
	await sleep(1500);
	await runCron(async () => /Could not send, 1 try, retrying/.test(await text("/letters")));
	assert.match(await text("/letters"), /535 5\.7\.8/);
	assert.equal(smtp.inbox.length, 2);

	// Settings change every page except Settings itself, and custom CSS cannot close its style element.
	assert.match(await text("/settings"), /Appearance[\s\S]*Writing/);
	assert.equal((await post("/settings", { accent: "red" })).status, 400);
	const saved = await post("/settings", {
		theme: "dark", font: "sans", size: "20", accent: "#1a5fb4", greeting: "Hello me,", prefix: "Note from", deliverIn: "12",
		prompts: "One\nTwo", css: "body { margin: 0 }</style><script>alert(1)</script>",
	});
	assert.equal(saved.status, 303);
	const themed = await text("/");
	assert.match(themed, /data-theme="dark"/);
	assert.match(themed, /--font: var\(--font-sans\); --size: 20px; --accent: #1a5fb4;/);
	assert.match(themed, /Hello me,[\s\S]*<option value="12" selected>[\s\S]*<li>One<\/li><li>Two<\/li>/);
	assert.match(themed, /body \{ margin: 0 \}\\3c \/style>\\3c script>/);
	assert.doesNotMatch(themed, /<script>alert/);
	assert.doesNotMatch(await text("/settings?saved"), /\\3c \/style>/, "Settings leaves out custom CSS");

	// The test email goes through the same SMTP settings.
	smtp.rejectAuth = false;
	const inboxBefore = smtp.inbox.length;
	const tested = await post("/settings/test", {});
	assert.equal(tested.status, 303);
	assert.match(await text(tested.headers.get("location")), /Test email sent to me@example\.com\./);
	assert.equal(smtp.inbox[inboxBefore].subject, "Someday test email");

	// The export holds every letter with its body, sealed ones included.
	const exported = await get("/export");
	assert.match(exported.headers.get("content-disposition"), /attachment; filename="someday-letters-/);
	const letters = await exported.json();
	assert.deepEqual(letters.map((l) => l.subject).sort(), ["Héllo <future> ✉", "In a year", "Will fail"]);
	assert.equal(letters.find((l) => l.subject === "In a year").body, "Hi");

	// Deleting, and signing out everywhere.
	assert.equal((await post("/letters/delete", { id: failingId })).status, 303);
	assert.doesNotMatch(await text("/letters"), /Will fail/);
	const out = await post("/signout-all", {});
	assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
	assert.equal((await get("/letters")).status, 303, "the old session no longer works");

	console.log("e2e: ok");
} finally {
	process.kill(-dev.pid);
	smtp.close();
	rmSync(dir, { recursive: true, force: true });
}
