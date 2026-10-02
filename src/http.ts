import type { Env } from "./env";
import type { Html } from "./pages/html";
import type { Settings } from "./settings";
import type { Store } from "./store";

/** What a route handler gets: the request, env, the store stub, the session token if signed in, and the path match. */
export interface Ctx {
	req: Request;
	env: Env;
	url: URL;
	store: DurableObjectStub<Store>;
	session: string | null;
	params: string[];
	view: View;
	/** Keeps the Worker running after the response for work the visitor should not wait on. */
	waitUntil(work: Promise<unknown>): void;
}

/** The context of a route that needs the owner signed in. */
export interface OwnerCtx extends Ctx {
	session: string;
}

/** What every page needs to render: the nonce that lets its style element apply, whether the owner is signed in, and the owner's settings (the defaults when signed out). */
export interface View {
	nonce: string;
	signedIn: boolean;
	settings: Settings;
}

const COOKIE = "someday";
// Browsers cap cookie lifetime at 400 days, the same as the session.
const COOKIE_MAX_AGE = 400 * 86400;

/** A page response. Only the style element carrying this request's nonce and scripts from this site run, so injected markup cannot run code. */
export function html(c: { view: View }, body: Html, status = 200): Response {
	const n = c.view.nonce;
	return new Response(body.value, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"Content-Security-Policy": `default-src 'none'; style-src 'nonce-${n}'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
			"Referrer-Policy": "no-referrer",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/** A random value for one response's Content-Security-Policy. */
export function newNonce(): string {
	return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/** A 303 redirect, so the browser follows a form POST with a GET. */
export function redirect(to: string): Response {
	return new Response(null, { status: 303, headers: { Location: to } });
}

export function setSession(res: Response, session: string | null): Response {
	const value = session ? `${COOKIE}=${session}; Max-Age=${COOKIE_MAX_AGE}` : `${COOKIE}=; Max-Age=0`;
	res.headers.append("Set-Cookie", `${value}; Path=/; HttpOnly; Secure; SameSite=Lax`);
	return res;
}

/** Returns the session cookie when it has the shape of a token (43 base64url characters), so a junk cookie never reaches the store. */
export function sessionCookie(req: Request): string | null {
	for (const part of (req.headers.get("Cookie") ?? "").split(";")) {
		const [k, v] = part.trim().split("=");
		if (k === COOKIE && v && /^[A-Za-z0-9_-]{43}$/.test(v)) return v;
	}
	return null;
}

/** Reads a form field as a string, empty when absent. */
export function field(form: FormData, name: string): string {
	const v = form.get(name);
	return typeof v === "string" ? v : "";
}
