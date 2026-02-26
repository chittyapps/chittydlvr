/**
 * Public Receipt Verification
 * No authentication required — anyone can verify a delivery receipt.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class PublicReceipt {
  static baseUrl = 'https://api.chitty.cc/dlvr/v1';

  /**
   * Verify a delivery receipt
   */
  static async verify(receiptId) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/verify/receipt/${encodeURIComponent(receiptId)}`);
    } catch (error) {
      return {
        receiptId,
        verified: false,
        error: `Network error: ${error.message}`
      };
    }

    if (!response.ok) {
      if (response.status === 404) {
        return { receiptId, verified: false, error: 'Receipt not found' };
      }
      return { receiptId, verified: false, error: `Server error: ${response.status}` };
    }

    try {
      return await response.json();
    } catch {
      return { receiptId, verified: false, error: 'Invalid response from server' };
    }
  }

  /**
   * Track a delivery
   */
  static async track(deliveryId) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/track/${encodeURIComponent(deliveryId)}`);
    } catch (error) {
      return {
        deliveryId,
        status: 'UNKNOWN',
        error: `Network error: ${error.message}`
      };
    }

    if (!response.ok) {
      return { deliveryId, status: 'UNKNOWN', error: `Server error: ${response.status}` };
    }

    try {
      return await response.json();
    } catch {
      return { deliveryId, status: 'UNKNOWN', error: 'Invalid response from server' };
    }
  }

  /**
   * Get an embeddable receipt badge
   */
  static getBadge(receiptId, options = {}) {
    const { size = 'medium', theme = 'light' } = options;
    const safeId = escapeHtml(receiptId);
    const safeSize = escapeHtml(size);
    const safeTheme = escapeHtml(theme);
    const encodedId = encodeURIComponent(receiptId);

    return {
      html: `<div class="chitty-receipt-badge" data-receipt="${safeId}" data-size="${safeSize}" data-theme="${safeTheme}"></div>`,
      script: '<script src="https://cdn.chitty.cc/dlvr/badge.js"></script>',
      imageUrl: `https://cdn.chitty.cc/dlvr/badge/${encodedId}.svg?size=${encodeURIComponent(size)}&theme=${encodeURIComponent(theme)}`,
      verifyUrl: `https://chitty.cc/receipt/${encodedId}`
    };
  }

  /**
   * Get QR code for receipt verification
   */
  static getQRCode(receiptId, options = {}) {
    const { size = 200 } = options;
    const encodedId = encodeURIComponent(receiptId);

    return {
      url: `https://cdn.chitty.cc/dlvr/qr/${encodedId}.png?size=${Number(size)}`,
      verifyUrl: `https://chitty.cc/receipt/${encodedId}`
    };
  }

  /**
   * Get delivery timeline widget
   */
  static getTimeline(deliveryId) {
    const safeId = escapeHtml(deliveryId);
    const encodedId = encodeURIComponent(deliveryId);

    return {
      html: `<div class="chitty-delivery-timeline" data-delivery="${safeId}"></div>`,
      script: '<script src="https://cdn.chitty.cc/dlvr/timeline.js"></script>',
      apiUrl: `${this.baseUrl}/timeline/${encodedId}`
    };
  }
}

export default PublicReceipt;
