/**
 * Delivery Channels
 * Each channel handles the actual dispatch of deliveries.
 */

const VALID_METHODS = ['email', 'sms', 'portal', 'api', 'physical', 'inPerson', 'legalService'];

export class DeliveryChannel {
  constructor(dlvr) {
    this.dlvr = dlvr;
  }

  /**
   * Dispatch a delivery through the appropriate channel
   */
  async dispatch(options) {
    const { deliveryId, method, address, mintId, timestamp } = options;

    if (!VALID_METHODS.includes(method)) {
      throw new Error(`Unsupported delivery method: ${method}. Valid methods: ${VALID_METHODS.join(', ')}`);
    }

    const handler = this.getHandler(method);
    return await handler({
      deliveryId,
      address,
      mintId,
      timestamp
    });
  }

  getHandler(method) {
    const handlers = {
      email: (opts) => this.sendEmail(opts),
      sms: (opts) => this.sendSMS(opts),
      portal: (opts) => this.sendPortal(opts),
      api: (opts) => this.sendAPI(opts),
      physical: (opts) => this.sendPhysical(opts),
      inPerson: (opts) => this.recordInPerson(opts),
      legalService: (opts) => this.initiateLegalService(opts)
    };

    return handlers[method];
  }

  /**
   * Certified email delivery
   * Dispatches through the registered email provider (RPost RMail) when
   * configured, so the send carries third-party Registered Receipt® proof.
   * Falls back to a simulated dispatch when no provider is configured.
   */
  async sendEmail(options) {
    const { deliveryId, address, mintId, timestamp } = options;

    const subject = `Document Delivery: ${mintId}`;
    const links = {
      view: `https://chitty.cc/view/${deliveryId}`,
      receipt: `https://chitty.cc/receipt/${deliveryId}`,
      decline: `https://chitty.cc/decline/${deliveryId}`
    };

    const base = {
      channel: 'email',
      to: address,
      subject,
      trackingPixel: true,
      readReceiptRequested: true,
      links,
      timestamp
    };

    const provider = this.dlvr.registeredEmail;
    if (!provider) {
      return {
        ...base,
        dispatched: true,
        simulated: true,
        messageId: `MSG-${deliveryId}`
      };
    }

    try {
      const result = await provider.send({
        to: address,
        subject,
        body: this.buildEmailBody({ deliveryId, mintId, links }),
        customerTrackingId: deliveryId,
        clientCode: mintId
      });

      return {
        ...base,
        dispatched: true,
        registered: true,
        provider: 'rpost',
        providerMode: provider.mode,
        messageId: result.trackingId || `MSG-${deliveryId}`,
        trackingId: result.trackingId,
        providerStatus: result.status
      };
    } catch (error) {
      return {
        ...base,
        dispatched: false,
        registered: false,
        provider: 'rpost',
        providerMode: provider.mode,
        error: error.message
      };
    }
  }

  buildEmailBody({ deliveryId, mintId, links }) {
    return [
      '<p>You have received a certified document delivery via ChittyDLVR.</p>',
      `<p>Document: <strong>${mintId}</strong><br>Delivery ID: <strong>${deliveryId}</strong></p>`,
      `<p><a href="${links.view}">View document</a> · <a href="${links.receipt}">Delivery receipt</a> · <a href="${links.decline}">Decline</a></p>`,
      '<p>This message is tracked and certified. Proof of delivery is recorded.</p>'
    ].join('\n');
  }

  /**
   * SMS delivery with confirmation
   */
  async sendSMS(options) {
    const { deliveryId, address, mintId, timestamp } = options;

    return {
      channel: 'sms',
      dispatched: true,
      messageId: `SMS-${deliveryId}`,
      to: address,
      body: `You have a certified document delivery. View: https://chitty.cc/view/${deliveryId}`,
      deliveryReport: true,
      timestamp
    };
  }

  /**
   * Secure portal delivery (requires auth)
   */
  async sendPortal(options) {
    const { deliveryId, mintId, timestamp } = options;

    return {
      channel: 'portal',
      dispatched: true,
      portalUrl: `https://portal.chitty.cc/delivery/${deliveryId}`,
      requiresAuth: true,
      authMethod: 'ChittyID',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      timestamp
    };
  }

  /**
   * API webhook delivery
   */
  async sendAPI(options) {
    const { deliveryId, address, mintId, timestamp } = options;

    return {
      channel: 'api',
      dispatched: true,
      webhookUrl: address,
      payload: {
        event: 'delivery.created',
        deliveryId,
        mintId,
        timestamp
      },
      retries: 3,
      timestamp
    };
  }

  /**
   * Physical mail tracking
   */
  async sendPhysical(options) {
    const { deliveryId, address, timestamp } = options;

    return {
      channel: 'physical',
      dispatched: true,
      carrier: null,
      trackingNumber: null,
      address,
      certified: true,
      returnReceiptRequested: true,
      timestamp
    };
  }

  /**
   * In-person delivery with witness
   */
  async recordInPerson(options) {
    const { deliveryId, timestamp } = options;

    return {
      channel: 'inPerson',
      dispatched: true,
      witnessRequired: true,
      witness: null,
      location: null,
      geoVerified: false,
      timestamp
    };
  }

  /**
   * Legal service initiation
   */
  async initiateLegalService(options) {
    const { deliveryId, timestamp } = options;

    return {
      channel: 'legalService',
      dispatched: true,
      serviceType: null,
      processServer: null,
      jurisdiction: null,
      affidavitRequired: true,
      timestamp
    };
  }
}

export default DeliveryChannel;
