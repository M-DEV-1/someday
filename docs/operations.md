# Operations

## Deploy

Follow [Getting started](../README.md#getting-started). The Deploy to Cloudflare button copies this repository into your GitHub account, creates the Worker, its Durable Object and the cron trigger, and asks for four secrets. Every later push to that copy redeploys the Worker.

## Change a setting

Open the Cloudflare dashboard, go to **Workers & Pages**, open the Worker, then **Settings → Variables and Secrets**. Edit `OWNER_EMAIL`, `SMTP_HOST`, `SMTP_USER` or `SMTP_PASSWORD` and save. The Worker picks up the new value on its next request.

Changing `OWNER_EMAIL` moves sign-in and every delivery to the new address, including letters written before the change, since a letter does not store its recipient.

## Update

Your copy is not linked to this repository, so fixes made here do not reach it on their own.

1. In your copy on GitHub, open **Actions → update someday → Run workflow**.
2. Leave `main`, or type a tag.
3. The action copies that version over your files, commits the change and pushes. Cloudflare then redeploys.

The action keeps your `wrangler.jsonc`, since you may have renamed the Worker. If the new version's `wrangler.jsonc` differs, the run shows a warning with the difference; copy any new binding or migration across by hand.

The action also skips `.github/`, because the workflow token cannot change workflow files. To pick up a changed workflow, copy it across by hand.

The update is never scheduled. A broken version deployed while nobody is watching would stop letters; an old version that works keeps sending them.

## Remove

1. In the Cloudflare dashboard, open the Worker, then **Settings → Delete**. This deletes the Durable Object and every letter in it.
2. Delete your copy of the repository on GitHub.

## Troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| "This Someday is not set up yet" | one of the four secrets is empty | set it in Variables and Secrets |
| "SMTP server said: 535 ..." | the mail server refused the login | make a new app password and set `SMTP_PASSWORD` |
| "SMTP server did not answer within 20 seconds" | wrong host or port, or the server is down | check `SMTP_HOST`; Gmail is `smtp.gmail.com`, iCloud is `smtp.mail.me.com:587` |
| "A link was sent a moment ago" | a link was sent in the last minute, or ten today | use the link already in your inbox, or wait |
| No sign-in email arrives | the address typed is not `OWNER_EMAIL`, or the mail went to spam | check the secret, then the spam folder |
| A letter says "Could not send", with a reply | delivery failed and will be retried | fix the cause; the next retry sends it, at most a day later |

Worker logs are on in `wrangler.jsonc`. In the dashboard, open the Worker, then **Logs**.

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars   # then fill in the four values
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | runs the Worker on http://localhost:8787 with local storage in `.wrangler/` |
| `npm test` | starts `wrangler dev` on fresh storage against a fake SMTP server and walks sign-in, writing, delivery, a failed delivery and sign-out |
| `npm run typecheck` | runs TypeScript |
| `npm run deploy` | deploys from your machine with `wrangler deploy` |

`SMTP_HOST=localhost:<port>` sends without TLS. Deployed Workers cannot reach localhost, so this only works in development.

CI runs the type check, a dry-run bundle and `npm test` on every push; see `.github/workflows/ci.yml`.

## Things that can break over years

- Gmail calls app passwords a last resort, and changing the Google account password revokes them. Sends then fail and are retried until `SMTP_PASSWORD` is set again.
- If SMTP stops working, signing in stops too, since sign-in is by email. Letters keep retrying and go out once the secret is fixed in the dashboard.
- `compatibility_date` is pinned, so the runtime behaves the same under a deployed Worker until you change it.
- Unknown: whether Cloudflare removes Workers from free accounts that stay idle for years.
