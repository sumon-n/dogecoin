# Base44 Dev Environment — Dogecoin Core

## What this is
Dogecoin Core (`dogecoind`) — a headless C++ blockchain node, no web UI.
The repo is the source tree; there is no prebuilt app image.

## How it runs here
- `docker-compose.base44.yml` has three services:
  - **builder** (one-shot, `ubuntu:22.04`): installs build deps (incl. `libzmq3-dev`),
    runs `./autogen.sh`, `./configure --without-gui --disable-tests --disable-bench --with-incompatible-bdb`,
    and `make -C src dogecoind dogecoin-cli`. Built artifacts live in the bind-mounted
    source tree, so they persist across restarts.
  - **node** (`ubuntu:22.04`): installs runtime libs (incl. `libzmq5`), runs
    `src/dogecoind -regtest` with RPC on 0.0.0.0. Depends on builder completing.
    ZMQ publishers enabled: `rawblock`, `rawtx`, `hashblock`, `hashtx` on `tcp://0.0.0.0:28332`.
  - **ws-bridge** (`node:22-slim`): subscribes to the node's ZMQ socket and re-broadcasts
    notifications as JSON over a WebSocket server on port 3000. Depends on node starting.
- Ports:
  - **3000 → 3000** — WebSocket bridge (live block/tx notifications).
  - **18332 → 18332** — JSON-RPC (regtest). Credentials: `base44` / `base44dev`.
- ZMQ internal port `28332` (node ↔ bridge only, not published).

## WebSocket protocol
Connect to `ws://<host>:3000`. On connect you receive:
`{"type":"connected","topics":["rawblock","rawtx","hashblock","hashtx"],...}`
On each block/transaction the node publishes, clients receive:
`{"type":"rawblock|rawtx|hashblock|hashtx","hex":"...","sequence":N,"timestamp":...}`

## Verifying it works
```
docker compose -f docker-compose.base44.yml ps
# RPC
curl -u base44:base44dev -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"1.0","id":"t","method":"getblockchaininfo","params":[]}' \
  http://localhost:18332/
# WebSocket + live notification: generate a block in regtest, watch WS messages arrive.
```

## Notes
- Full build takes several minutes (large C++ codebase). Re-runs reconfigure + incremental
  `make`, fast once objects exist.
- Wallet support uses libdb5.3 (incompatible-bdb flag), not the legacy BDB 4.8.
- Dogecoin Core has native ZMQ (not WebSocket) for notifications; the ws-bridge service
  bridges ZMQ → WebSocket so browsers/clients can receive real-time pushes.
- No external credentials/secrets are needed — everything runs locally.
