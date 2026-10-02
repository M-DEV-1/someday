// End-to-end test: runs `wrangler dev` on empty storage against a fake SMTP server and walks sign-in, writing, delivery, a failed delivery, deletion and sign-out.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Mail, startFakeSmtp } from "./fake-smtp.ts";

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
const get = (path: string) => fetch(BASE + path, { headers: { Cookie: cookie }, redirect: "manual" });
const post = (path: string, fields: Record<string, string>) =>
	fetch(BASE + path, { method: "POST", body: new URLSearchParams(fields), headers: { Cookie: cookie }, redirect: "manual" });
const text = async (path: string) => (await get(path)).text();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const inSeconds = (s: number) => String(Math.floor(Date.now() / 1000) + s);

/** Uploads a backup file to the restore form. */
function restore(json: string) {
	const form = new FormData();
	form.append("file", new Blob([json], { type: "application/json" }), "backup.json");
	return fetch(`${BASE}/restore`, { method: "POST", body: form, headers: { Cookie: cookie }, redirect: "manual" });
}

/** The value of a response header; fails the test when it is missing. */
function header(res: Response, name: string): string {
	const value = res.headers.get(name);
	assert.ok(value !== null, `no ${name} header`);
	return value;
}

/** The first capture group of `re` in `s`; fails the test when there is no match. */
function grab(s: string, re: RegExp): string {
	const found = s.match(re)?.[1];
	assert.ok(found !== undefined, `no match for ${re}`);
	return found;
}

/** The message at this position in the fake inbox; fails the test when there is none. */
function mail(i: number): Mail {
	const m = smtp.inbox[i];
	assert.ok(m, `no message ${i} in the inbox`);
	return m;
}

/** The parts of a backup file the test checks. */
interface Backup {
	settings: { theme: string; backup: boolean };
	letters: { id: string; subject: string; body: string; delivered: string | null }[];
}

function readBackup(json: string): Backup {
	const backup = JSON.parse(json);
	assert.equal(backup.format, "someday-backup");
	return backup;
}

/** Triggers the cron handler and waits until `done()` holds, since the handler finishes in the background. */
async function runCron(done: () => boolean | Promise<boolean>) {
	await get("/__scheduled?cron=*/5+*+*+*+*");
	await waitFor(done, "cron run did not finish");
}

/** Waits up to 10 seconds for `done()` to hold, for work the Worker finishes after responding. */
async function waitFor(done: () => boolean | Promise<boolean>, message: string) {
	for (let i = 0; i < 40 && !(await done()); i++) await sleep(250);
	assert.ok(await done(), message);
}

try {
	for (let i = 0; ; i++) {
		try {
			await fetch(BASE);
			break;
		} catch {
			if (i > 80) throw new Error("wrangler dev did not start");
			await sleep(500);
		}
	}

	// Signed out: only the sign-in page, and a stranger's address gets no mail.
	assert.equal((await get("/wp-login.php")).status, 404);
	const csp = header(await get("/"), "content-security-policy");
	assert.match(csp, /script-src 'self'/);
	assert.match(await (await fetch(`${BASE}/js/write.js`)).text(), /deliver_at/);
	assert.doesNotMatch(csp, /unsafe-inline/);
	assert.match(await text("/"), /Send link/);
	assert.equal((await get("/letters")).status, 303);
	assert.equal((await fetch(`${BASE}/letters`, { headers: { Cookie: "someday=junk" }, redirect: "manual" })).status, 303);
	assert.equal((await post("/letters", { subject: "x", body: "x", in: "12" })).status, 403);
	assert.match(await (await post("/signin", { email: "stranger@example.com" })).text(), /a sign-in link is on its way/);
	assert.equal(smtp.inbox.length, 0, "a stranger's address gets no mail");

	// The owner gets a one-time link; a second request within a minute looks the same but sends nothing.
	const ownerPage = await post("/signin", { email: "ME@example.com" });
	assert.equal(ownerPage.status, 200);
	assert.match(await ownerPage.text(), /a sign-in link is on its way/, "the owner gets the same page as a stranger");
	await waitFor(() => smtp.inbox.length === 1, "no sign-in email");
	assert.equal(mail(0).subject, "Your Someday sign-in link");
	const link = grab(mail(0).text, /\/auth\?t=([\w-]+)/);
	assert.match(await (await post("/signin", { email: OWNER })).text(), /a sign-in link is on its way/);
	await sleep(1000);
	assert.equal(smtp.inbox.length, 1, "a second link within a minute is not sent");

	// Opening the link only shows a button; pressing it signs in once.
	assert.match(await text(`/auth?t=${link}`), /Sign in to Someday/);
	const signedIn = await post("/auth", { t: link });
	assert.equal(signedIn.status, 303);
	cookie = grab(header(signedIn, "set-cookie"), /^([^;]*)/);
	assert.equal((await post("/auth", { t: link })).status, 401, "a link works once");
	const crossSite = await fetch(`${BASE}/signout`, { method: "POST", headers: { Cookie: cookie, "Sec-Fetch-Site": "cross-site" }, redirect: "manual" });
	assert.equal(crossSite.status, 403, "a form post from another site is refused");

	// Writing: validation keeps the draft, the no-JavaScript "Deliver in" path works, and upcoming letters stay sealed.
	assert.match(await text("/"), /A letter from[\s\S]*Dear future me,[\s\S]*Send<\/button>[\s\S]*<summary class="small">Prompts/);
	const past = await post("/letters", { subject: "Old", body: "Keep this text", date: "2000-01-01" });
	assert.equal(past.status, 400);
	assert.match(await past.text(), /Keep this text[\s\S]*Pick a date in the future/);
	const yearAway = await post("/letters", { subject: "In a year", body: "Hi", in: "12" });
	assert.equal(yearAway.status, 303);
	assert.match(await text(header(yearAway, "location")), /Sealed\. Arrives .*, in 1 year\./);

	const soon = await post("/letters", { subject: "Héllo <future> ✉", body: "Dear me,\nstill here?", deliver_at: inSeconds(1), tz: "Asia/Kolkata" });
	const soonId = grab(header(soon, "location"), /sent=(\w+)/);
	assert.equal((await get(`/letters/${soonId}`)).status, 303, "an upcoming letter cannot be opened");

	// Delivery: the cron sends the due letter only, and it can then be read.
	await sleep(1500);
	await runCron(() => smtp.inbox.length === 3);
	const delivered = mail(1);
	assert.equal(delivered.to, `<${OWNER}>`);
	assert.equal(delivered.subject, "Héllo <future> ✉");
	assert.match(delivered.messageId, new RegExp(`^<${soonId}@`), "the Message-ID comes from the letter, so a resend is the same message");
	assert.match(delivered.text, /^Dear me,\nstill here\?\n\n--\nYou wrote this on /);
	assert.match(await text(`/letters/${soonId}`), /Héllo &#60;future&#62; ✉[\s\S]*Dear me,\nstill here\?/);
	assert.match(await text("/letters"), /Sealed<\/h1>[\s\S]*In a year[\s\S]*Delivered<\/h1>[\s\S]*Héllo/);

	// The same pass emails the first backup, with every letter attached, the sealed one included.
	const backupMail = mail(2);
	assert.match(backupMail.subject, /^Someday backup, /);
	assert.match(backupMail.attachments[0]?.filename ?? "", /^someday-backup-\d{4}-\d{2}-\d{2}\.json$/);
	const emailed = readBackup(backupMail.attachments[0]?.content ?? "");
	assert.equal(emailed.letters.find((l) => l.subject === "In a year")?.body, "Hi");
	assert.equal(emailed.letters.length, 2);

	// A letter the server refuses is marked failed, and the letter after it in the same pass still goes out.
	smtp.refuseSubject = "Refuse me";
	await post("/letters", { subject: "Refuse me", body: "x", deliver_at: inSeconds(1), tz: "UTC" });
	await post("/letters", { subject: "After the refusal", body: "y", deliver_at: inSeconds(2), tz: "UTC" });
	await sleep(2500);
	await runCron(() => smtp.inbox.some((m) => m.subject === "After the refusal"));
	assert.match(await text("/letters"), /Refuse me[\s\S]*Could not send, 1 try, retrying: SMTP server said: 554 5\.7\.1/);
	smtp.refuseSubject = "";

	// A failed login is shown on the letter and retried later instead of being dropped.
	smtp.rejectAuth = true;
	const failing = await post("/letters", { subject: "Will fail", body: "x", deliver_at: inSeconds(1), tz: "UTC" });
	const failingId = grab(header(failing, "location"), /sent=(\w+)/);
	await sleep(1500);
	await runCron(async () => /Will fail[\s\S]*Could not send, 1 try, retrying/.test(await text("/letters")));
	assert.match(await text("/letters"), /535 5\.7\.8/);
	smtp.rejectAuth = false;

	// With mail working again, a pass sends no second backup, since the next one is 30 days away.
	await runCron(() => true);
	await sleep(1500);
	assert.equal(smtp.inbox.filter((m) => m.subject.startsWith("Someday backup")).length, 1, "the next backup is 30 days away");

	// Settings change every page except Settings itself, and custom CSS cannot close its style element.
	assert.match(await text("/settings"), /Appearance[\s\S]*Writing/);
	assert.equal((await post("/settings", { accent: "red" })).status, 400);
	const saved = await post("/settings", {
		theme: "dark",
		font: "sans",
		size: "20",
		accent: "#1a5fb4",
		greeting: "Hello me,",
		prefix: "Note from",
		deliverIn: "12",
		prompts: "One\nTwo",
		backup: "off",
		css: "body { margin: 0 }</style><script>alert(1)</script>",
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
	assert.match(await text(header(tested, "location")), /Test email sent to me@example\.com\./);
	assert.equal(mail(inboxBefore).subject, "Someday test email");

	// The backup holds the settings and every letter with its body, sealed ones included.
	const download = await get("/backup");
	assert.match(header(download, "content-disposition"), /attachment; filename="someday-backup-\d{4}-\d{2}-\d{2}\.json"/);
	const backupJson = await download.text();
	const backup = readBackup(backupJson);
	assert.equal(backup.settings.theme, "dark");
	assert.equal(backup.settings.backup, false, "an unticked checkbox turns the backup email off");
	assert.deepEqual(backup.letters.map((l) => l.subject).sort(), ["After the refusal", "Héllo <future> ✉", "In a year", "Refuse me", "Will fail"]);
	assert.equal(backup.letters.find((l) => l.subject === "In a year")?.body, "Hi");

	// Deleting, and signing out everywhere.
	assert.equal((await post("/letters/delete", { id: failingId })).status, 303);
	assert.doesNotMatch(await text("/letters"), /Will fail/);

	// Restoring the backup brings back the deleted letter and the settings; restoring it again adds nothing.
	assert.equal((await post("/settings", { theme: "light" })).status, 303);
	const restored = await restore(backupJson);
	assert.equal(restored.status, 303);
	assert.match(await text(header(restored, "location")), /Restored the settings and 1 letter\. 4 were already here\./);
	assert.match(await text("/letters"), /Will fail/);
	assert.match(await text("/"), /data-theme="dark"/);
	assert.equal((await get(`/letters/${failingId}`)).status, 303, "a restored sealed letter stays sealed");
	assert.match(await text(`/letters/${soonId}`), /Dear me,\nstill here\?/);
	assert.match(await text(header(await restore(backupJson), "location")), /Restored the settings and 0 letters\. 5 were already here\./);
	assert.equal((await restore("{}")).status, 400);
	const out = await post("/signout-all", {});
	assert.match(header(out, "set-cookie"), /Max-Age=0/);
	assert.equal((await get("/letters")).status, 303, "the old session no longer works");

	console.log("e2e: ok");
} finally {
	if (dev.pid) process.kill(-dev.pid);
	smtp.close();
	rmSync(dir, { recursive: true, force: true });
}
