/**
 * ChittyDLVR SDK Client
 * For API consumers who want to use ChittyDLVR as a service.
 */

export class DLVRClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.chitty.cc/dlvr/v1';
    this.timeout = config.timeout || 30000;

    if (!this.apiKey) {
      throw new DLVRError('API key required', 'AUTH_REQUIRED');
    }
  }

  /**
   * Send a certified delivery
   */
  async send(options) {
    return this.request('POST', '/send', options);
  }

  /**
   * Get delivery status
   */
  async status(deliveryId) {
    return this.request('GET', `/status/${deliveryId}`);
  }

  /**
   * Confirm delivery
   */
  async confirm(deliveryId, confirmation) {
    return this.request('POST', `/confirm/${deliveryId}`, confirmation);
  }

  /**
   * Create receipt
   */
  async receipt(deliveryId, options) {
    return this.request('POST', `/receipt/${deliveryId}`, options);
  }

  /**
   * Initiate legal service
   */
  async serve(options) {
    return this.request('POST', '/serve', options);
  }

  /**
   * Record affidavit
   */
  async affidavit(serviceId, details) {
    return this.request('POST', `/service/${serviceId}/affidavit`, details);
  }

  /**
   * Bulk send
   */
  async bulkSend(options) {
    return this.request('POST', '/bulk', options);
  }

  /**
   * Verify a receipt (no auth needed)
   */
  async verifyReceipt(receiptId) {
    return this.request('GET', `/verify/receipt/${receiptId}`, null, false);
  }

  /**
   * Get delivery timeline
   */
  async timeline(deliveryId) {
    return this.request('GET', `/timeline/${deliveryId}`);
  }

  // ============ HTTP ============

  async request(method, path, body = null, requiresAuth = true) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (requiresAuth) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new DLVRError(
          error.message || 'Request failed',
          error.code || 'REQUEST_FAILED',
          response.status
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new DLVRError('Request timeout', 'TIMEOUT', 408);
      }
      throw error;
    }
  }
}

export class DLVRError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'DLVRError';
    this.code = code;
    this.status = status;
  }
}

export default DLVRClient;
