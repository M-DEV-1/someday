<div align="center">

# Someday

**Letters to your future self, from your own Cloudflare account.**

Write a letter, pick a date, and it arrives in your inbox on that day, in a month or in ten years. Someday runs on the Cloudflare free plan and sends through the email account you already have.

<p>
  <a href="https://github.com/M-DEV-1/someday/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/M-DEV-1/someday/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Runs on" src="https://img.shields.io/badge/runs_on-Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-white?style=flat-square">
</p>

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/M-DEV-1/someday)

</div>

## What Someday does

**Writes like FutureMe.** A letter starts "Dear future me,", the subject reads "A letter from" today's date, and delivery is one click: 6 months, 1, 3, 5 or 10 years, or any date you pick. "Inspire me" offers a question to write about, and full screen hides everything but the letter.

**Delivers on the day.** A letter arrives at 9:00 in your time zone on the date you chose. If your mail server refuses it, Someday shows the error and keeps retrying, up to once a day, for as long as it takes.

**Only you can sign in.** The site is public, but sign-in is a one-time link emailed to the owner's address. Any other address gets no email.

**Keeps letters sealed.** Upcoming letters show only a subject and a date until they arrive. Subjects and bodies are encrypted with AES-256-GCM in storage.

**Needs no email service.** Letters go out through your own SMTP account, such as Gmail with an app password. There is no Resend, Mailgun or other vendor that could shut down.

<div align="center">

**[Get started](#getting-started)** · **[Architecture](docs/architecture.md)** · **[Operations](docs/operations.md)**

</div>

## Getting started

You do this once. After that there is nothing to run or renew.

You need:

| Account | Why |
|---|---|
| [Cloudflare](https://dash.cloudflare.com/sign-up), free plan | runs the Worker and stores the letters |
| [GitHub](https://github.com/signup) | the Deploy button puts your own copy of the code here, and Cloudflare deploys from it |
| An email account with SMTP | sends the letters; Gmail works and is used below |

1. **Make an app password.** Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) for your Google account, then [create an app password](https://myaccount.google.com/apppasswords). Copy the 16 letters.
2. **Click Deploy to Cloudflare** at the top of this page. Sign in to Cloudflare, and connect your GitHub account when asked.
3. **Fill in four values.** Cloudflare asks for them before it deploys:

   | Name | What to enter | Gmail example |
   |---|---|---|
   | `OWNER_EMAIL` | the only address that can sign in; letters arrive here | `you@gmail.com` |
   | `SMTP_HOST` | your mail server | `smtp.gmail.com` |
   | `SMTP_USER` | your mail login | `you@gmail.com` |
   | `SMTP_PASSWORD` | the app password from step 1, without spaces | `abcdefghijklmnop` |

4. **Deploy.** Cloudflare copies the code into your GitHub account, builds it and gives you an address ending in `workers.dev`.
5. **Sign in.** Open that address, enter your email and click the link that arrives. The link arriving shows your mail settings work.
6. **Write your first letter.**

Other mail providers: iCloud is `smtp.mail.me.com:587` and Fastmail is `smtp.fastmail.com`. A host with no port uses 465 with TLS; add `:587` for servers that use STARTTLS.

If something goes wrong, [Troubleshooting](docs/operations.md#troubleshooting) lists each error and its fix.

## Your data

Everything lives in your Cloudflare account, in one Durable Object: the letters, the sign-in tokens and the encryption key. Your SMTP server sees each letter when it is sent. Nothing else leaves your account.

## Update

Your copy does not change unless you ask it to. In your copy on GitHub, open **Actions → update someday → Run workflow**, and Cloudflare redeploys the new version. See [Update](docs/operations.md#update).

## Remove

Delete the Worker in the Cloudflare dashboard, which deletes every letter with it, then delete your copy on GitHub.

## Develop

Needs Node 22.

```bash
git clone https://github.com/M-DEV-1/someday.git && cd someday
npm install
npm test
```

`npm test` runs the Worker locally against a fake mail server. [Local development](docs/operations.md#local-development) covers the rest.

## License

MIT
