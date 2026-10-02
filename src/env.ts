import type { Store } from "./store";

/** Bindings the Worker gets from wrangler.jsonc. */
export interface Env {
	STORE: DurableObjectNamespace<Store>;
}
