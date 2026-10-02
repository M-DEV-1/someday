import type { View } from "../http";
import { CSS } from "./style";

/** Escapes text for use inside HTML element content and quoted attributes. */
export function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Wraps page content in the shared document, header and navigation. The navigation shows only when signed in. */
export function layout(view: View, content: string): string {
	const nav = view.signedIn
		? [
				`<a href="/">Write</a>`,
				`<a href="/letters">My letters</a>`,
				`<form method="post" action="/signout"><button class="link">Sign out</button></form>`,
			].join("")
		: "";
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Someday</title>
<style nonce="${view.nonce}">${CSS}</style>
</head>
<body>
<header><a class="logo" href="/">someday</a>${view.signedIn ? `<nav>${nav}</nav>` : ""}</header>
<main>${content}</main>
</body>
</html>`;
}
