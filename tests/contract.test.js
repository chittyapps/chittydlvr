/**
 * ChittyDLVR Consumer Contract Tests
 * Verify the API contract works as documented.
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.DLVR_URL || 'https://dlvr.chitty.cc';
const AUTH_TOKEN = process.env.CHITTY_AUTH_SERVICE_TOKEN || '';
const SKIP = !AUTH_TOKEN;

function headers(auth = true) {
  const h = { 'Content-Type': 'application/json' };
  if (auth && AUTH_TOKEN) h['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  return h;
}

describe('ChittyDLVR Contract', () => {
  describe('public endpoints', () => {
    it('GET /health returns status ok', async () => {
      const res = await fetch(`${BASE_URL}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('ChittyDLVR');
    });

    it('GET /api/v1/status returns service metadata', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/status`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('ChittyDLVR');
      expect(body.version).toBeDefined();
      expect(body.uri).toBe('chittycanon://core/services/chittydlvr');
      expect(body.tier).toBe(4);
    });
  });

  describe('auth enforcement', () => {
    it('POST /dlvr/v1/send without auth returns 401', async () => {
      const res = await fetch(`${BASE_URL}/dlvr/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mintId: 'DM-TEST', to: 'test', method: 'email', address: 'a@b.com' })
      });
      expect(res.status).toBe(401);
    });

    it('POST /dlvr/v1/send with bad token returns 401', async () => {
      const res = await fetch(`${BASE_URL}/dlvr/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer bad-token' },
        body: JSON.stringify({ mintId: 'DM-TEST', to: 'test', method: 'email', address: 'a@b.com' })
      });
      expect(res.status).toBe(401);
    });
  });

  describe('public verification', () => {
    it('GET /track/:id with invalid ID returns 400', async () => {
      const res = await fetch(`${BASE_URL}/track/INVALID`);
      expect(res.status).toBe(400);
    });

    it('GET /verify/receipt/:id with invalid ID returns 400', async () => {
      const res = await fetch(`${BASE_URL}/verify/receipt/INVALID`);
      expect(res.status).toBe(400);
    });
  });

  describe.skipIf(SKIP)('authenticated operations', () => {
    let deliveryId;

    it('POST /dlvr/v1/send creates a delivery', async () => {
      const res = await fetch(`${BASE_URL}/dlvr/v1/send`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          mintId: 'DM-CONTRACT-TEST',
          to: 'recipient-id',
          method: 'email',
          address: 'test@chitty.cc'
        })
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.deliveryId).toMatch(/^DD-/);
      expect(body.status).toBe('SENT');
      expect(body.proof.pillar).toBe('delivery');
      deliveryId = body.deliveryId;
    });

    it('GET /dlvr/v1/status/:id returns delivery status', async () => {
      const res = await fetch(`${BASE_URL}/dlvr/v1/status/${deliveryId}`, {
        headers: headers()
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deliveryId).toBe(deliveryId);
    });

    it('POST /dlvr/v1/receipt/:id creates a signed receipt', async () => {
      const res = await fetch(`${BASE_URL}/dlvr/v1/receipt/${deliveryId}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ signer: 'recipient-id', method: 'digital' })
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.receiptId).toMatch(/^DR-/);
      expect(body.status).toBe('VALID');
      expect(body.signature.value).toBeDefined();
      expect(body.signature.publicKey).toBeDefined();
      expect(body.drand).toBeDefined();
    });

    it('POST /dlvr/v1/send rejects missing mintId', async () => {
      const res = await fetch(`${BASE_URL}/dlvr/v1/send`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ to: 'test', method: 'email', address: 'a@b.com' })
      });
      expect(res.status).toBe(400);
    });

    it('POST /dlvr/v1/send rejects invalid JSON', async () => {
      const res = await fetch(`${BASE_URL}/dlvr/v1/send`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: 'not json'
      });
      expect(res.status).toBe(400);
    });
  });
});
