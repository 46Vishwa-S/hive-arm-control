/**
 * HiveArm — Cloudflare Worker entry.
 *
 * Routes:
 *   GET  /ws         → upgrade to WebSocket, attach to ArmRelay Durable Object
 *   GET  /health     → liveness probe
 *   *                → static site (if [assets] binding is configured) or 404
 *
 * The relay lives in a single global Durable Object instance ("global") so that
 * the browser (anywhere on the internet) and the ESP32 (anywhere on the
 * internet) always land on the same coordinator and can exchange messages in
 * real time.
 */

export interface Env {
  RELAY: DurableObjectNamespace;
  ASSETS?: Fetcher; // present only if [assets] is configured in wrangler.toml
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/ws") {
      // All clients (browser + ESP32) share one DO instance.
      const id = env.RELAY.idFromName("global");
      const stub = env.RELAY.get(id);
      return stub.fetch(request);
    }

    // Fall through to static assets if available, otherwise 404.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("HiveArm relay — connect to /ws", { status: 404 });
  },
};

/* ------------------------------------------------------------------ */
/*  Durable Object: ArmRelay                                          */
/*                                                                    */
/*  Holds every connected WebSocket and broadcasts each inbound       */
/*  message to all *other* peers. Uses the Hibernation API so idle    */
/*  sockets cost nothing.                                             */
/* ------------------------------------------------------------------ */

type Role = "browser" | "esp32" | "unknown";

export class ArmRelay implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Detect role from query string (?role=esp32 or ?role=browser).
    // Falls back to "unknown" — both still relay normally.
    const url = new URL(request.url);
    const role = (url.searchParams.get("role") as Role) || "unknown";

    // Hibernation: the runtime will deliver events via webSocketMessage/Close
    // without keeping the DO instance pinned in memory.
    this.state.acceptWebSocket(server, [role]);

    // Greet new peer.
    server.send(
      JSON.stringify({
        type: "hello",
        role,
        peers: this.state.getWebSockets().length,
        ts: Date.now(),
      }),
    );

    // Notify the other side that a new peer joined.
    this.broadcast(
      JSON.stringify({ type: "peer_join", role, ts: Date.now() }),
      server,
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Hibernation callback: an incoming message on an accepted socket. */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    // Pass through to every other connected peer.
    this.broadcast(message, ws);
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    const tags = this.state.getTags(ws);
    const role = (tags[0] as Role) ?? "unknown";
    try {
      ws.close(code, reason);
    } catch {}
    this.broadcast(
      JSON.stringify({ type: "peer_leave", role, ts: Date.now() }),
    );
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, "internal error");
    } catch {}
  }

  /** Send `msg` to every connected websocket except `except`. */
  private broadcast(msg: string | ArrayBuffer, except?: WebSocket) {
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(msg);
      } catch {
        try {
          ws.close(1011, "send failed");
        } catch {}
      }
    }
  }
}
