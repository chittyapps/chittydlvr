/**
 * ChittyDLVR Core Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChittyDLVR } from '../src/core/dlvr.js';

describe('ChittyDLVR', () => {
  let dlvr;

  beforeEach(() => {
    dlvr = new ChittyDLVR({ apiKey: 'test-key-minimum-16ch', chittyId: 'test-chitty-id' });
  });

  describe('constructor', () => {
    it('initializes with config', () => {
      expect(dlvr.apiKey).toBe('test-key-minimum-16ch');
      expect(dlvr.chittyId).toBe('test-chitty-id');
      expect(dlvr.initialized).toBe(false);
    });

    it('has default baseUrl', () => {
      expect(dlvr.baseUrl).toBe('https://api.chitty.cc/dlvr/v1');
    });

    it('creates core engines', () => {
      expect(dlvr.channels).toBeDefined();
      expect(dlvr.receipts).toBeDefined();
      expect(dlvr.service).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('sets initialized to true', async () => {
      await dlvr.initialize();
      expect(dlvr.initialized).toBe(true);
    });

    it('is idempotent', async () => {
      const result1 = await dlvr.initialize();
      const result2 = await dlvr.initialize();
      expect(result1).toBe(result2);
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      await dlvr.initialize();
    });

    it('sends a certified delivery via email', async () => {
      const result = await dlvr.send({
        mintId: 'DM-TEST-123',
        to: 'recipient-id',
        method: 'email',
        address: 'recipient@example.com'
      });

      expect(result.deliveryId).toMatch(/^DD-/);
      expect(result.mintId).toBe('DM-TEST-123');
      expect(result.method).toBe('email');
      expect(result.status).toBe('SENT');
      expect(result.trackingUrl).toContain('chitty.cc/track/');
    });

    it('sends via portal method', async () => {
      const result = await dlvr.send({
        mintId: 'DM-TEST-456',
        to: 'recipient-id',
        method: 'portal'
      });

      expect(result.method).toBe('portal');
      expect(result.dispatch.channel).toBe('portal');
      expect(result.dispatch.requiresAuth).toBe(true);
    });

    it('generates unique delivery IDs', async () => {
      const r1 = await dlvr.send({ mintId: 'DM-1', to: 'a', method: 'email', address: 'a@b.com' });
      const r2 = await dlvr.send({ mintId: 'DM-2', to: 'b', method: 'email', address: 'b@c.com' });
      expect(r1.deliveryId).not.toBe(r2.deliveryId);
    });

    it('includes delivery proof pillar data', async () => {
      const result = await dlvr.send({
        mintId: 'DM-TEST',
        to: 'recipient',
        method: 'email',
        address: 'test@example.com'
      });

      expect(result.proof.pillar).toBe('delivery');
      expect(result.proof.mintId).toBe('DM-TEST');
      expect(result.proof.score).toBeGreaterThan(0);
    });

    it('includes status history', async () => {
      const result = await dlvr.send({
        mintId: 'DM-TEST',
        to: 'recipient',
        method: 'email',
        address: 'test@example.com'
      });

      expect(result.statusHistory).toHaveLength(2);
      expect(result.statusHistory[0].status).toBe('PENDING');
      expect(result.statusHistory[1].status).toBe('SENT');
    });

    it('throws on unsupported delivery method', async () => {
      await expect(dlvr.send({
        mintId: 'DM-TEST',
        to: 'recipient',
        method: 'pigeon',
        address: 'nest'
      })).rejects.toThrow('Unsupported delivery method');
    });

    it('throws when mintId is missing', async () => {
      await expect(dlvr.send({
        to: 'recipient',
        method: 'email',
        address: 'test@example.com'
      })).rejects.toThrow('mintId is required');
    });
  });

  describe('confirm', () => {
    it('confirms delivery', async () => {
      await dlvr.initialize();
      const result = await dlvr.confirm('DD-TEST-123', { method: 'email' });

      expect(result.deliveryId).toBe('DD-TEST-123');
      expect(result.status).toBe('DELIVERED');
      expect(result.confirmation.channelConfirmed).toBe(true);
    });
  });

  describe('opened', () => {
    it('records open event', async () => {
      await dlvr.initialize();
      const result = await dlvr.opened('DD-TEST-123', { method: 'email' });

      expect(result.deliveryId).toBe('DD-TEST-123');
      expect(result.status).toBe('OPENED');
      expect(result.proof.score).toBeGreaterThan(0);
    });
  });

  describe('receipt', () => {
    it('creates a signed receipt with real ECDSA signature', async () => {
      await dlvr.initialize();
      const result = await dlvr.receipt('DD-TEST-123', {
        signer: 'recipient-chitty-id',
        method: 'digital'
      });

      expect(result.receiptId).toMatch(/^DR-/);
      expect(result.deliveryId).toBe('DD-TEST-123');
      expect(result.signer).toBe('recipient-chitty-id');
      expect(result.status).toBe('VALID');
      expect(result.witnessed).toBe(true);
      expect(result.witness).toBe('ChittyOS');
      // Real crypto: signature has value and publicKey
      expect(result.signature.value).toBeDefined();
      expect(result.signature.publicKey).toBeDefined();
      expect(result.signature.signedPayload).toBeDefined();
    });

    it('includes legal scoring', async () => {
      await dlvr.initialize();
      const result = await dlvr.receipt('DD-TEST-123', {
        signer: 'recipient-id',
        method: 'digital'
      });

      expect(result.legal.admissible).toBe(true);
      expect(result.legal.standard).toBe('ChittyProof');
      expect(result.legal.pillar).toBe('delivery');
      expect(result.legal.score).toBeGreaterThan(0);
      expect(result.legal.technical).toBeGreaterThan(0);
      expect(result.legal.arguable).toBeGreaterThan(0);
    });
  });

  describe('serve (legal service)', () => {
    it('initiates service of process', async () => {
      await dlvr.initialize();
      const result = await dlvr.serve('DM-CONTRACT-123', {
        respondent: 'John Doe',
        serviceType: 'personal',
        address: { street: '123 Main St', city: 'Chicago', state: 'IL' },
        jurisdiction: 'Cook County, IL'
      });

      expect(result.serviceId).toMatch(/^DS-/);
      expect(result.mintId).toBe('DM-CONTRACT-123');
      expect(result.respondent).toBe('John Doe');
      expect(result.serviceType).toBe('personal');
      expect(result.status).toBe('INITIATED');
      expect(result.proof.method).toBe('legalService');
    });

    it('includes service requirements', async () => {
      await dlvr.initialize();
      const result = await dlvr.serve('DM-TEST', {
        respondent: 'Jane Doe',
        serviceType: 'substituted'
      });

      expect(result.requirements.atAddress).toBe(true);
      expect(result.requirements.competentPerson).toBe(true);
      expect(result.requirements.mailCopy).toBe(true);
    });

    it('throws on invalid service type', async () => {
      await dlvr.initialize();
      await expect(dlvr.serve('DM-TEST', {
        respondent: 'Jane Doe',
        serviceType: 'telekinesis'
      })).rejects.toThrow('Invalid service type');
    });
  });

  describe('recordService (affidavit)', () => {
    it('records an affidavit of service', async () => {
      await dlvr.initialize();
      const result = await dlvr.recordService('DS-TEST-123', {
        processServer: 'SERVER-001',
        serviceType: 'personal',
        details: {
          servedTo: 'John Doe',
          location: '123 Main St, Chicago, IL',
          jurisdiction: 'Cook County, IL'
        }
      });

      expect(result.affidavitId).toMatch(/^DA-/);
      expect(result.serviceId).toBe('DS-TEST-123');
      expect(result.sworn).toBe(true);
      expect(result.status).toBe('FILED');
      expect(result.proof.score).toBeGreaterThanOrEqual(90);
    });
  });

  describe('bulkSend', () => {
    it('sends to multiple recipients', async () => {
      await dlvr.initialize();
      const result = await dlvr.bulkSend({
        mintId: 'DM-BULK-TEST',
        recipients: [
          { to: 'alice', method: 'email', address: 'alice@example.com' },
          { to: 'bob', method: 'sms', address: '+1234567890' },
          { to: 'charlie', method: 'portal' }
        ]
      });

      expect(result.bulkId).toMatch(/^DB-/);
      expect(result.totalRecipients).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.deliveries).toHaveLength(3);
    });

    it('handles individual failures gracefully', async () => {
      await dlvr.initialize();
      const result = await dlvr.bulkSend({
        mintId: 'DM-BULK-TEST',
        recipients: [
          { to: 'alice', method: 'email', address: 'alice@example.com' },
          { to: 'bob', method: 'invalid_method', address: 'x' },
          { to: 'charlie', method: 'portal' }
        ]
      });

      expect(result.totalRecipients).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('calculateDeliveryScore', () => {
    it('scores legalService highest', () => {
      const score = dlvr.calculateDeliveryScore('legalService', 'RECEIPTED');
      expect(score).toBe(95);
    });

    it('scores PENDING as 0', () => {
      const score = dlvr.calculateDeliveryScore('email', 'PENDING');
      expect(score).toBe(0);
    });

    it('scores REFUSED as partial (attempted)', () => {
      const score = dlvr.calculateDeliveryScore('email', 'REFUSED');
      expect(score).toBeGreaterThan(0);
    });

    it('scores email SENT as partial', () => {
      const score = dlvr.calculateDeliveryScore('email', 'SENT');
      expect(score).toBe(21); // 70 * 0.3
    });
  });
});
