# Operations

## Deploy

Follow [Getting started](../README.md#getting-started). The Deploy to Cloudflare button copies this repository into your GitHub account, creates the Worker, its Durable Object and the cron trigger, and asks for four secrets. Every later push to that copy redeploys the Worker.

## Change a setting

Appearance, the greeting, the subject, the default delivery time, the prompts and custom CSS are on the **Settings** page of Someday itself. The same page turns the monthly backup email on or off, sends a test email, downloads and restores backups, and signs out every browser.

The four secrets are in Cloudflare. Open the Cloudflare dashboard, go to **Workers & Pages**, open the Worker, then **Settings → Variables and Secrets**. Edit `OWNER_EMAIL`, `SMTP_HOST`, `SMTP_USER` or `SMTP_PASSWORD` and save. The Worker picks up the new value on its next request. Saving restarts the store, so a letter being sent at that moment can arrive a second time.

Changing `OWNER_EMAIL` moves sign-in and every delivery to the new address, including letters written before the change, since a letter does not store its recipient.

## Update

Your copy is not linked to this repository, so fixes made here do not reach it on their own.

1. In your copy on GitHub, open **Actions → update someday → Run workflow**.
2. Leave `main`, or type a tag.
3. The action copies that version over your files, runs the type check and `npm test` on it, then commits and pushes. Cloudflare then redeploys. If the check fails, nothing is pushed.

The action keeps your `wrangler.jsonc`, since you may have renamed the Worker. If the new version's `wrangler.jsonc` differs, the run shows a warning with the difference; copy any new binding or migration across by hand.

The action also skips `.github/`, because the workflow token cannot change workflow files. To pick up a changed workflow, copy it across by hand.

The update is never scheduled. A broken version deployed while nobody is watching would stop letters; an old version that works keeps sending them.

## Move to a new account

Use this if Cloudflare changes its free plan, closes your account, or you want Someday somewhere else.

1. Get a backup. The newest one is in your inbox, from the monthly backup email, subject "Someday backup". If the old Someday still runs, **Download a backup** on its Settings page gets a current one.
2. Deploy a new Someday with the [Deploy button](../README.md#getting-started), into the new account.
3. Sign in, open **Settings**, choose the backup file under **Restore**, and press **Restore**.

Every letter comes back with its delivery date, delivered letters stay delivered, and sealed letters whose date passed in the meantime go out within 5 minutes. The settings come back too.

If no Someday can run at all, the backup is plain JSON: each letter's `subject`, `body` and `deliver` date can be read with any text editor.

## Remove

1. In the Cloudflare dashboard, open the Worker, then **Settings → Delete**. This deletes the Durable Object and every letter in it.
2. Delete your copy of the repository on GitHub.

## Troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| "This Someday is not set up yet" | a secret is empty, or `OWNER_EMAIL` or `SMTP_USER` is not a plain address | the message names the secret; fix it in Variables and Secrets |
| "SMTP server said: 535 ..." | the mail server refused the login | make a new app password and set `SMTP_PASSWORD` |
| "SMTP server did not answer within 20 seconds" | wrong host or port, or the server is down | check `SMTP_HOST`; Gmail is `smtp.gmail.com`, iCloud is `smtp.mail.me.com:587` |
| No sign-in email arrives | the address typed is not `OWNER_EMAIL`, the mail went to spam, the mail server refused the login, or a link was already sent in the last minute or ten were sent today | check the secret and the spam folder; a refused login shows as "Sign-in email failed" in the Worker's **Logs**; otherwise wait a minute, or after ten links in a day, until the next day |
| Settings says "The last backup email could not be sent" | the mail server refused the backup, often because it is larger than the provider allows (Gmail: 25 MB) | use **Download a backup** instead; the email is tried again every day |
| A letter says "Could not send", with a reply | delivery failed and will be retried | fix the cause, then use **Send a test email** on the Settings page; the next retry sends the letter, at most a day later |
| A letter's subject is "(could not be decrypted)" | the row or the key was changed outside Someday | the letter cannot be recovered; delete it |

Worker logs are on in `wrangler.jsonc`. In the dashboard, open the Worker, then **Logs**.

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars   # then fill in the four values
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | builds the browser scripts and runs the Worker on http://localhost:8787 with local storage in `.wrangler/` |
| `npm run build` | bundles `src/client/` into `public/js/` with esbuild; `wrangler dev` and `wrangler deploy` run it first |
| `npm test` | starts `wrangler dev` on fresh storage against a fake SMTP server and walks sign-in, writing, delivery, the backup email, a failed delivery, settings, the test email, backup download and restore, and signing out everywhere |
| `npm run typecheck` | runs TypeScript on the Worker, the browser scripts and the test |
| `npm run lint` | runs Biome's formatter check and linter |
| `npm run knip` | lists unused files, exports and dependencies |
| `npm run deploy` | deploys from your machine with `wrangler deploy` |

`SMTP_HOST=localhost:<port>` sends without TLS. Deployed Workers cannot reach localhost, so this only works in development.

CI runs the type check, Biome, knip, a dry-run bundle and `npm test` on pushes to `main` and on pull requests; see `.github/workflows/ci.yml`. A push from the update action does not start CI, which is why the update action runs the same checks itself.

## Things that can break over years

- Gmail calls app passwords a last resort, and changing the Google account password revokes them. Sends then fail and are retried until `SMTP_PASSWORD` is set again.
- If SMTP stops working, signing in stops too, since sign-in is by email. A browser that is already signed in stays signed in for 400 days.
- Anyone who knows `OWNER_EMAIL` can use up the ten sign-in links a day. A signed-in browser is not affected; otherwise wait until the next day. Letters keep retrying and go out once the secret is fixed in the dashboard.
- `compatibility_date` is pinned, so the runtime behaves the same under a deployed Worker until you change it.
- Unknown: whether Cloudflare removes Workers from free accounts that stay idle for years.
