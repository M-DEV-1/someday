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
