---
uri: chittycanon://docs/tech/spec/chittydlvr-dev-guide
namespace: chittycanon://docs/tech
type: spec
version: 1.0.0
status: CERTIFIED
registered_with: chittycanon://core/services/canon
title: "ChittyDLVR Development Guide"
visibility: PUBLIC
---

# ChittyDLVR

Certified delivery engine with cryptographic proof of receipt. Cloudflare Worker at `dlvr.chitty.cc`.

## Commands

```bash
npm install          # Install dependencies
npm test             # Run tests (vitest run)
npm run dev          # Watch mode tests
npm run deploy       # Deploy to Cloudflare Workers
npm run lint         # TypeScript check (tsc --noEmit)
```

## Architecture

```
src/
├── worker.js           # CF Worker entry point, auth, routing, CORS, public routes
├── core/
│   ├── dlvr.js         # Delivery orchestrator (send, confirm, receipt, bulk)
│   ├── receipt.js      # ECDSA-P256 signed receipts + drand anchoring
│   ├── channels.js     # Delivery channel dispatch (email, SMS, portal, etc.)
│   └── service.js      # Legal service of process engine
├── sdk/client.js       # SDK client for external consumers
├── verify/public.js    # Public verification badges + embeds
└── index.js            # Package exports
```

## Key Patterns

- **Receipts**: ECDSA-P256-SHA256 via `crypto.subtle`. Persistent key from `SIGNING_KEY_JWK` env. Each receipt embeds public key for self-contained verification.
- **Auth**: Bearer token validated against `CHITTY_AUTH_SERVICE_TOKEN` via constant-time hash-then-XOR comparison.
- **Temporal**: drand.cloudflare.com beacon anchors receipts with publicly verifiable timestamps.
- **Channels**: 7 delivery methods — email, SMS, portal, API, physical, inPerson, legalService.
- **IDs**: `DD-` (delivery), `DR-` (receipt), `DS-` (service), `DA-` (affidavit), `DB-` (bulk).
- **Public routes**: `/verify/receipt/:id` and `/track/:id` require no auth.

## Environment

| Secret | Purpose |
|--------|---------|
| `CHITTY_AUTH_SERVICE_TOKEN` | Bearer token auth |
| `SIGNING_KEY_JWK` | Persistent ECDSA P-256 private key (JWK) |
| `INTERNAL_API_KEY` | Internal service initialization (required) |
| `CHITTY_ID` | Service identity |

## Routes

- `dlvr.chitty.cc/*` — Primary domain
- `api.chitty.cc/dlvr/*` — API gateway
