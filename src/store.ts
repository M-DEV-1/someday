import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

/** The one Durable Object behind an instance. It owns the SQLite database and hands each call from the Worker to the module that owns that table. */
export class Store extends DurableObject<Env> {
}
