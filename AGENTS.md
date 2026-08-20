# Base44 Dev Environment — Dogecoin Core

## What this is
Dogecoin Core (`dogecoind`) — a headless C++ blockchain node, no web UI.
The repo is the source tree; there is no prebuilt app image.

## How it runs here
- `docker-compose.base44.yml` has two services:
  - **builder** (one-shot, `ubuntu:22.04`): installs build deps, runs `./autogen.sh`,
    `./configure --without-gui --disable-tests --disable-bench --with-incompatible-bdb`,
    and `make -C src dogecoind dogecoin-cli`. Skips if `src/dogecoind` already exists.
    Built artifacts live in the bind-mounted source tree, so they persist across restarts.
  - **node** (`ubuntu:22.04`): installs only the runtime libs, then runs
    `src/dogecoind -regtest` with RPC on 0.0.0.0. Depends on builder completing.
- Port **3000 → 18332** (regtest JSON-RPC). RPC credentials: `base44` / `base44dev`.

## Verifying it works
```
docker compose -f docker-compose.base44.yml ps
curl -u base44:base44dev -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"1.0","id":"t","method":"getblockchaininfo","params":[]}' \
  http://localhost:3000/
```
Should return JSON with `"chain":"regtest"`.

## Notes
- Full build takes several minutes (large C++ codebase). Re-runs skip the build.
- Wallet support uses libdb5.3 (incompatible-bdb flag), not the legacy BDB 4.8.
- The preview shows the raw RPC endpoint — a `getblockchaininfo` POST returns node
  status; a GET returns a 404 (expected, it's an RPC server, not a web server).
- No external credentials/secrets are needed — everything runs locally.
