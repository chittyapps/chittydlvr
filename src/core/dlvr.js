/**
 * ChittyDLVR Core
 * "Delivered. Confirmed. Defended."
 *
 * Certified delivery engine. Every send produces proof.
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
    this.initialized = true;
    return this;
  }

  /**
   * Send a certified delivery
   *
   * @param {Object} options
   * @param {string} options.mintId - DocuMint document ID
   * @param {string} options.to - Recipient ChittyID or address
   * @param {string} options.method - Delivery method (email, sms, portal, etc.)
   * @param {string} options.address - Delivery address (email, phone, etc.)
   * @param {Object} options.options - Method-specific options
   * @returns {Promise<DeliveryResult>}
   */
  async send(options) {
    const { mintId, to, method = 'email', address, options: deliveryOptions = {} } = options;

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
   *
   * @param {string} deliveryId
   * @param {Object} confirmation - Channel-specific confirmation data
   * @returns {Promise<DeliveryStatus>}
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
   *
   * @param {string} deliveryId
   * @param {Object} viewData
   * @returns {Promise<DeliveryStatus>}
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
   *
   * @param {string} deliveryId
   * @param {Object} options
   * @param {string} options.signer - Recipient ChittyID
   * @param {string} options.method - How receipt was obtained
   * @returns {Promise<Receipt>}
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
   *
   * @param {string} deliveryId
   * @returns {Promise<DeliveryTimeline>}
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
   *
   * @param {string} mintId - Document to serve
   * @param {Object} options
   * @param {string} options.respondent - Person being served
   * @param {string} options.serviceType - personal, substituted, constructive, publication
   * @param {Object} options.address - Physical address for service
   * @returns {Promise<ServiceResult>}
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
   *
   * @param {string} serviceId
   * @param {Object} affidavit
   * @returns {Promise<ServiceProof>}
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
   *
   * @param {Object} options
   * @param {string} options.mintId - Document to deliver
   * @param {Array} options.recipients - Array of {to, method, address}
   * @returns {Promise<BulkDeliveryResult>}
   */
  async bulkSend(options) {
    const { mintId, recipients } = options;
    const results = [];

    for (const recipient of recipients) {
      const result = await this.send({
        mintId,
        ...recipient
      });
      results.push(result);
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

  /**
   * Calculate delivery proof score based on method and status
   */
  calculateDeliveryScore(method, status) {
    const methodScores = {
      legalService: 95,  // Process server with affidavit
      inPerson: 90,      // In-person with witness
      portal: 85,        // Secure portal with auth
      email: 70,         // Email with read receipt
      sms: 60,           // SMS with delivery confirm
      api: 65,           // API webhook
      physical: 75       // Tracked mail
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
      REFUSED: 0.5  // Refused still counts as attempted delivery
    };

    const baseScore = methodScores[method] || 50;
    const multiplier = statusMultipliers[status] || 0;

    return Math.round(baseScore * multiplier);
  }

  // ============ ID Generation ============

  generateDeliveryId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `DD-${timestamp}-${random}`.toUpperCase();
  }

  generateBulkId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `DB-${timestamp}-${random}`.toUpperCase();
  }
}

export default ChittyDLVR;
