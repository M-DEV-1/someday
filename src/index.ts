import type { Env } from "./env";
import { html, redirect, sessionCookie, type Ctx } from "./http";
import { signInPage } from "./pages/signin";
import { confirmLink, redeemLink, signIn } from "./routes/auth";
import { Store } from "./store";

export { Store };

type Handler = (c: Ctx) => Promise<Response>;

/** Method, path pattern, handler, and whether the route needs a signed-in session. */
const ROUTES: [string, RegExp, Handler, boolean][] = [
	["GET", /^\/$/, async () => html(signInPage()), false],
	["POST", /^\/signin$/, signIn, false],
	["GET", /^\/auth$/, confirmLink, false],
	["POST", /^\/auth$/, redeemLink, false],
];

export default {
	async fetch(req, env) {
		const url = new URL(req.url);
		for (const [method, path, handler, needsSession] of ROUTES) {
			const match = req.method === method && url.pathname.match(path);
			if (!match) continue;

			const store = env.STORE.getByName("main");
			const cookie = sessionCookie(req);
			const session = cookie && (await store.isSignedIn(cookie)) ? cookie : null;
			if (needsSession && !session) return req.method === "GET" ? redirect("/") : new Response("Sign in first", { status: 403 });
			return handler({ req, env, url, store, session, params: match.slice(1) });
		}
		// Unknown routes return before the Durable Object is touched, so scanner traffic costs nothing.
		return new Response("Not found", { status: 404 });
	},

	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(env.STORE.getByName("main").deliverDue());
	},
} satisfies ExportedHandler<Env>;
