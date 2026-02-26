---
uri: chittycanon://docs/ops/policy/chittydlvr-charter
namespace: chittycanon://docs/ops
type: policy
version: 1.0.0
status: DRAFT
registered_with: chittycanon://core/services/canon
title: "ChittyDLVR Charter"
certifier: chittycanon://core/services/chittycertify
visibility: PUBLIC
---

# ChittyDLVR Charter

## Classification
- **Canonical URI**: `chittycanon://core/services/chittydlvr`
- **Tier**: 4 (Domain)
- **Organization**: chittyapps
- **Domain**: dlvr.chitty.cc

## Mission

Certified delivery engine with cryptographic proof of receipt. Every send produces proof. Integrates with DocuMint's Pillar 4 (Delivery Proof) for legally defensible delivery confirmation with ECDSA-P256 signed receipts and drand temporal anchoring.

## Scope

### IS Responsible For
- Certified delivery dispatch (email, SMS, portal, API, physical, in-person, legal service)
- ECDSA-P256 signed delivery receipts with drand temporal anchoring
- Delivery status tracking and timeline
- Legal service of process initiation and affidavit recording
- Bulk delivery operations
- Public receipt verification

### IS NOT Responsible For
- Document creation or signing (DocuMint)
- Identity generation (ChittyID)
- Token provisioning (ChittyAuth)
- Service registration (ChittyRegister)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Upstream | ChittyAuth | Authentication |
| Upstream | DocuMint | Document minting (provides mintId) |
| External | drand.cloudflare.com | Temporal anchoring |

## API Contract

**Base URL**: https://dlvr.chitty.cc

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
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

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | chittyapps |
| Contact | dlvr@chitty.cc |

## Compliance

- [ ] Service registered in ChittyRegistry
- [x] Health endpoint operational at /health
- [ ] CLAUDE.md development guide present
- [x] CHARTER.md present
- [x] CHITTY.md present

---
*Charter Version: 1.0.0 | Last Updated: 2026-02-25*
