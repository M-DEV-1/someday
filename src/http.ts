const COOKIE = "someday";
// Browsers cap cookie lifetime at 400 days, the same as the session.
const COOKIE_MAX_AGE = 400 * 86400;

const HTML_HEADERS = {
	"Content-Type": "text/html; charset=utf-8",
	"Cache-Control": "no-store",
	"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
	"Referrer-Policy": "no-referrer",
};

export function html(body: string, status = 200): Response {
	return new Response(body, { status, headers: HTML_HEADERS });
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

export function sessionCookie(req: Request): string | null {
	for (const part of (req.headers.get("Cookie") ?? "").split(";")) {
		const [k, v] = part.trim().split("=");
		if (k === COOKIE && v) return v;
	}
	return null;
}

/** Reads a form field as a string, empty when absent. */
export function field(form: FormData, name: string): string {
	const v = form.get(name);
	return typeof v === "string" ? v : "";
}
