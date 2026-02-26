/**
 * ChittyDLVR Core
 * "Delivered. Confirmed. Defended."
 *
 * Certified delivery engine. Every send produces proof.
 * @canon chittycanon://core/services/chittydlvr
 * Integrates with DocuMint's Pillar 4 (Delivery Proof).
 */

import { DeliveryChannel } from './channels.js';
import { ReceiptEngine } from './receipt.js';
import { ServiceEngine } from './service.js';

export class ChittyDLVR {
  constructor(config = {}) {
    this.apiKey = config.apiKey || null;
    this.baseUrl = config.baseUrl || 'https://api.chitty.cc/dlvr/v1';
    this.chittyId = config.chittyId || null;
    this.signingKeyJwk = config.signingKeyJwk || null;

    // Core engines
    this.channels = new DeliveryChannel(this);
    this.receipts = new ReceiptEngine(this);
    this.service = new ServiceEngine(this);

    this.initialized = false;
  }

  /**
   * Initialize ChittyDLVR
   */
  async initialize() {
    if (this.initialized) return this;

    if (this.apiKey) {
      await this.validateApiKey();
    }

    this.initialized = true;
    return this;
  }

  /**
   * Send a certified delivery
   */
  async send(options) {
    const { mintId, to, method = 'email', address, options: deliveryOptions = {} } = options;

    if (!mintId || typeof mintId !== 'string') {
      throw new Error('mintId is required and must be a string');
    }

    const deliveryId = this.generateDeliveryId();
    const timestamp = new Date().toISOString();

    // Create delivery record
    const delivery = {
      deliveryId,
      mintId,
      from: this.chittyId || 'anonymous',
      to,
      method,
      address,

      // Dispatch through channel
      dispatch: await this.channels.dispatch({
        deliveryId,
        method,
        address,
        mintId,
        options: deliveryOptions,
        timestamp
      }),

      // Status tracking
      status: 'SENT',
      statusHistory: [
        { status: 'PENDING', timestamp, actor: 'system' },
        { status: 'SENT', timestamp: new Date().toISOString(), actor: 'system' }
      ],

      // Proof linkage
      proof: {
        pillar: 'delivery',
        mintId,
        deliveryId,
        method,
        score: this.calculateDeliveryScore(method, 'SENT')
      },

      // Timestamps
      createdAt: timestamp,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      receiptedAt: null,

      // Tracking
      trackingUrl: `https://chitty.cc/track/${deliveryId}`,
      receiptUrl: `https://chitty.cc/receipt/${deliveryId}`
    };

    return delivery;
  }

  /**
   * Record delivery confirmation from channel
   */
  async confirm(deliveryId, confirmation = {}) {
    const timestamp = new Date().toISOString();

    return {
      deliveryId,
      status: 'DELIVERED',
      confirmedAt: timestamp,
      confirmation: {
        ...confirmation,
        channelConfirmed: true,
        timestamp
      },
      proof: {
        pillar: 'delivery',
        score: this.calculateDeliveryScore(confirmation.method || 'email', 'DELIVERED')
      }
    };
  }

  /**
   * Record that recipient opened/viewed the delivery
   */
  async opened(deliveryId, viewData = {}) {
    const timestamp = new Date().toISOString();

    return {
      deliveryId,
      status: 'OPENED',
      openedAt: timestamp,
      viewData: {
        ...viewData,
        ip: viewData.ip || null,
        userAgent: viewData.userAgent || null,
        timestamp
      },
      proof: {
        pillar: 'delivery',
        score: this.calculateDeliveryScore(viewData.method || 'email', 'OPENED')
      }
    };
  }

  /**
   * Create a signed receipt (cryptographic proof of receipt)
   */
  async receipt(deliveryId, options = {}) {
    return await this.receipts.create({
      deliveryId,
      signer: options.signer,
      method: options.method || 'digital',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get full delivery status with timeline
   */
  async status(deliveryId) {
    return {
      deliveryId,
      status: 'PENDING',
      timeline: [],
      receipt: null,
      proof: {
        pillar: 'delivery',
        score: 0
      },
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * Initiate legal service of process
   */
  async serve(mintId, options) {
    return await this.service.initiate({
      mintId,
      ...options,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Record proof of service (affidavit from process server)
   */
  async recordService(serviceId, affidavit) {
    return await this.service.recordAffidavit({
      serviceId,
      ...affidavit,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Bulk send - deliver to multiple recipients
   */
  async bulkSend(options) {
    const { mintId, recipients } = options;

    if (!mintId || typeof mintId !== 'string') {
      throw new Error('mintId is required and must be a string');
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('recipients must be a non-empty array');
    }

    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.send({
          mintId,
          ...recipient
        });
        results.push(result);
      } catch (error) {
        results.push({
          deliveryId: null,
          to: recipient.to,
          method: recipient.method,
          status: 'FAILED',
          error: error.message
        });
      }
    }

    return {
      bulkId: this.generateBulkId(),
      mintId,
      totalRecipients: recipients.length,
      sent: results.filter(r => r.status === 'SENT').length,
      failed: results.filter(r => r.status === 'FAILED').length,
      deliveries: results,
      createdAt: new Date().toISOString()
    };
  }

  // ============ Scoring ============

  calculateDeliveryScore(method, status) {
    const methodScores = {
      legalService: 95,
      inPerson: 90,
      portal: 85,
      email: 70,
      sms: 60,
      api: 65,
      physical: 75
    };

    const statusMultipliers = {
      PENDING: 0,
      SENT: 0.3,
      DELIVERED: 0.6,
      OPENED: 0.75,
      ACKNOWLEDGED: 0.85,
      RECEIPTED: 1.0,
      FAILED: 0,
      BOUNCED: 0,
      REFUSED: 0.5
    };

    const baseScore = methodScores[method] || 50;
    const multiplier = statusMultipliers[status] || 0;

    return Math.round(baseScore * multiplier);
  }

  // ============ ID Generation ============

  generateDeliveryId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `DD-${Date.now().toString(36)}-${random}`.toUpperCase();
  }

  generateBulkId() {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `DB-${Date.now().toString(36)}-${random}`.toUpperCase();
  }

  async validateApiKey() {
    if (!this.apiKey) return false;
    if (typeof this.apiKey !== 'string' || this.apiKey.length < 16) {
      throw new Error('Invalid API key format');
    }
    return true;
  }
}

export default ChittyDLVR;
