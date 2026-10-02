import type { Env } from "./env";
import { html, newNonce, redirect, sessionCookie, type Ctx } from "./http";
import { signInPage } from "./pages/signin";
import { DEFAULTS } from "./settings";
import { confirmLink, redeemLink, signIn, signOut } from "./routes/auth";
import { createLetter, deleteLetter, listLetters, readLetter, writeForm } from "./routes/letters";
import { exportLetters } from "./routes/export";
import { saveSettings, sendTest, settingsForm } from "./routes/settings";
import { Store } from "./store";

export { Store };

type Handler = (c: Ctx) => Promise<Response>;

/** Method, path pattern, handler, and whether the route needs a signed-in session. */
const ROUTES: [string, RegExp, Handler, boolean][] = [
	["GET", /^\/$/, (c) => (c.session ? writeForm(c) : Promise.resolve(html(c, signInPage(c.view)))), false],
	["POST", /^\/signin$/, signIn, false],
	["GET", /^\/auth$/, confirmLink, false],
	["POST", /^\/auth$/, redeemLink, false],
	["POST", /^\/signout$/, signOut, true],
	["GET", /^\/letters$/, listLetters, true],
	["POST", /^\/letters$/, createLetter, true],
	["GET", /^\/letters\/([0-9A-Z]{26})$/, readLetter, true],
	["POST", /^\/letters\/delete$/, deleteLetter, true],
	["GET", /^\/settings$/, settingsForm, true],
	["POST", /^\/settings$/, saveSettings, true],
	["POST", /^\/settings\/test$/, sendTest, true],
	["GET", /^\/export$/, exportLetters, true],
];

export default {
	async fetch(req, env) {
		const url = new URL(req.url);
		for (const [method, path, handler, needsSession] of ROUTES) {
			const match = req.method === method && url.pathname.match(path);
			if (!match) continue;

			// SameSite=Lax already keeps the cookie off cross-site posts; browsers that send Sec-Fetch-Site get them refused outright.
			const site = req.headers.get("Sec-Fetch-Site");
			if (method === "POST" && site && site !== "same-origin" && site !== "none") return new Response("Cross-site form posts are refused", { status: 403 });

			const store = env.STORE.getByName("main");
			const cookie = sessionCookie(req);
			const settings = cookie ? await store.session(cookie) : null;
			const session = settings ? cookie : null;
			if (needsSession && !session) return req.method === "GET" ? redirect("/") : new Response("Sign in first", { status: 403 });
			return handler({ req, env, url, store, session, params: match.slice(1), view: { nonce: newNonce(), signedIn: !!settings, settings: settings ?? DEFAULTS } });
		}
		// Unknown routes return before the Durable Object is touched, so scanner traffic costs nothing.
		return new Response("Not found", { status: 404 });
	},

	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(env.STORE.getByName("main").deliverDue());
	},
} satisfies ExportedHandler<Env>;
