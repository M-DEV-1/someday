import type { Env } from "./env";
import { Store } from "./store";

export { Store };

export default {
	async fetch() {
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
