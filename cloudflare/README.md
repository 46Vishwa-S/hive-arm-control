# HiveArm Cloudflare Relay

A single Cloudflare Worker + Durable Object that relays WebSocket traffic
between the HiveArm browser console and the ESP32 servo controller, over the
public internet (different Wi-Fi, different cities — works).

```
Browser ──wss──▶ Worker ──▶ Durable Object ◀── wss ── ESP32
                     (ArmRelay — holds all sockets, broadcasts)
```

## Why a Durable Object?

A plain Worker invocation is stateless and short-lived — it cannot hold a
roster of connected clients. A Durable Object is a single, addressable,
long-lived JS instance with built-in WebSocket Hibernation. Every client
opens `/ws`, the Worker forwards the upgrade to the same DO instance
(`idFromName("global")`), and the DO broadcasts each inbound frame to all
other peers.

## Deploy

```bash
cd cloudflare
npm i -g wrangler           # if not installed
bun install                 # or: npm install
wrangler login
wrangler deploy
```

This publishes to `https://hivearm.<your-subdomain>.workers.dev`.
If your account already owns `hivearm.noreplyglobalx1.workers.dev`, the
deploy will replace it.

## Endpoints

| Path      | Purpose                                          |
| --------- | ------------------------------------------------ |
| `/ws`     | WebSocket upgrade — both browser and ESP32       |
| `/health` | Liveness probe (`200 ok`)                        |
| `/*`      | Static site (only if `[assets]` is enabled)      |

Optional role hint: connect to `/ws?role=browser` or `/ws?role=esp32` so
peers can identify each other in the `hello` / `peer_join` frames.

## Frontend

The HiveArm UI already speaks `servoIdx,angle` over a single WebSocket.
The default URL is set to:

```
wss://hivearm.noreplyglobalx1.workers.dev/ws?role=browser
```

Change it from the "WebSocket URI" field in the console if you deploy to a
different subdomain.

## ESP32

See `esp32/hivearm_client.ino`. Fill in your Wi-Fi credentials and flash.
The sketch uses `WebSocketsClient::beginSSL()` so it works through
Cloudflare's TLS edge.

## Hosting the website from the same Worker (optional)

1. From the project root: `bun run build`
2. Copy the build output (the static files Vite/TanStack Start emits for the
   client) into `cloudflare/public/`.
3. Uncomment the `[assets]` block in `wrangler.toml`.
4. `wrangler deploy`.

If you keep the site on Lovable's preview/published URL instead, leave
`[assets]` commented out — the Worker is then purely a relay.
