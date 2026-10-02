import type { Env } from "./env";
import { html, newNonce, redirect, sessionCookie, type Ctx, type OwnerCtx } from "./http";
import { signInPage } from "./pages/signin";
import { DEFAULTS } from "./settings";
import { confirmLink, redeemLink, signIn, signOut, signOutEverywhere } from "./routes/auth";
import { createLetter, deleteLetter, listLetters, readLetter, writeForm } from "./routes/letters";
import { exportLetters } from "./routes/export";
import { saveSettings, sendTest, settingsForm } from "./routes/settings";
import { Store } from "./store";

export { Store };

type Method = "GET" | "POST";

/** Method, path pattern, handler, and whether the route needs the owner signed in. A route that does gets a context whose session is always set. */
type Route = [Method, RegExp, (c: Ctx) => Promise<Response>, false] | [Method, RegExp, (c: OwnerCtx) => Promise<Response>, true];

const ROUTES: Route[] = [
	["GET", /^\/$/, (c: Ctx) => (c.session ? writeForm({ ...c, session: c.session }) : Promise.resolve(html(c, signInPage(c.view)))), false],
	["POST", /^\/signin$/, signIn, false],
	["GET", /^\/auth$/, confirmLink, false],
	["POST", /^\/auth$/, redeemLink, false],
	["POST", /^\/signout$/, signOut, true],
	["POST", /^\/signout-all$/, signOutEverywhere, true],
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
		try {
			return await route(req, env);
		} catch (e) {
			// The stack goes to the Worker's logs; the visitor gets a plain page without it.
			console.error(e);
			return new Response("Something went wrong. The details are in the Worker's logs.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
		}
	},

	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(env.STORE.getByName("main").deliverDue());
	},
} satisfies ExportedHandler<Env>;

/** Finds the route for a request, checks the session, and runs the handler. */
async function route(req: Request, env: Env): Promise<Response> {
	const url = new URL(req.url);
	for (const r of ROUTES) {
		const [method, path] = r;
		const match = req.method === method && url.pathname.match(path);
		if (!match) continue;

		// SameSite=Lax already keeps the cookie off cross-site posts; browsers that send Sec-Fetch-Site get them refused outright.
		const site = req.headers.get("Sec-Fetch-Site");
		if (method === "POST" && site && site !== "same-origin" && site !== "none") return new Response("Cross-site form posts are refused", { status: 403 });

		const store = env.STORE.getByName("main");
		const cookie = sessionCookie(req);
		const settings = cookie ? await store.session(cookie) : null;
		const session = settings ? cookie : null;
		const c: Ctx = { req, env, url, store, session, params: match.slice(1), view: { nonce: newNonce(), signedIn: !!settings, settings: settings ?? DEFAULTS } };
		if (!r[3]) return r[2](c);
		if (!session) return req.method === "GET" ? redirect("/") : new Response("Sign in first", { status: 403 });
		return r[2]({ ...c, session });
	}
	// Unknown routes return before the Durable Object is touched, so scanner traffic costs nothing.
	return new Response("Not found", { status: 404 });
}
