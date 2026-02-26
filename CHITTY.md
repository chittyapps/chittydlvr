---
uri: chittycanon://docs/ops/architecture/chittydlvr
namespace: chittycanon://docs/ops
type: architecture
version: 1.0.0
status: CERTIFIED
registered_with: chittycanon://core/services/canon
title: "ChittyDLVR"
certifier: chittycanon://core/services/chittycertify
visibility: PUBLIC
---

# ChittyDLVR

> `chittycanon://core/services/chittydlvr` | Tier 4 (Domain) | dlvr.chitty.cc

## What It Does

Certified delivery with cryptographic proof of receipt. Delivered. Confirmed. Defended.

## Architecture

Cloudflare Worker deployed at dlvr.chitty.cc.

### Stack
- **Runtime**: Cloudflare Workers
- **Language**: JavaScript (ESM)
- **Crypto**: Web Crypto API (ECDSA-P256-SHA256)
- **Temporal**: drand.cloudflare.com beacon

### Key Components
- `src/worker.js` — Entry point, auth, routing, CORS, public routes
- `src/core/dlvr.js` — Delivery orchestrator, scoring
- `src/core/receipt.js` — ECDSA-P256 signed receipts with drand anchoring
- `src/core/channels.js` — Delivery channel dispatch (email, SMS, portal, etc.)
- `src/core/service.js` — Legal service of process engine
- `src/sdk/client.js` — SDK for external consumers
- `src/verify/public.js` — Public verification badges

## ChittyOS Ecosystem

### Certification
- **Badge**: ChittyCertified
- **Certifier**: ChittyCertify (`chittycanon://core/services/chittycertify`)
- **Last Certified**: 2026-02-25

### ChittyDNA
- **Lineage**: root (original service)
- **Relationship**: Sibling to DocuMint (consumes mintId for delivery proof)

### Dependencies
| Service | Purpose |
|---------|---------|
| ChittyAuth | Token validation |
| DocuMint | Document minting (provides mintId) |
| drand.cloudflare.com | Temporal anchoring |

### Endpoints
| Path | Method | Auth | Purpose |
|------|--------|------|---------|
| `/health` | GET | No | Health check |
| `/api/v1/status` | GET | No | Service metadata |
| `/dlvr/v1/send` | POST | Yes | Send certified delivery |
| `/dlvr/v1/status/:id` | GET | Yes | Delivery status |
| `/dlvr/v1/confirm/:id` | POST | Yes | Confirm delivery |
| `/dlvr/v1/receipt/:id` | POST | Yes | Create signed receipt |
| `/dlvr/v1/serve` | POST | Yes | Legal service of process |
| `/dlvr/v1/bulk` | POST | Yes | Bulk delivery |
| `/verify/receipt/:id` | GET | No | Public receipt verification |
| `/track/:id` | GET | No | Public delivery tracking |
