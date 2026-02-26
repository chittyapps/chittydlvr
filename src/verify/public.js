/**
 * Public Receipt Verification
 * No authentication required — anyone can verify a delivery receipt.
 */

export class PublicReceipt {
  static baseUrl = 'https://api.chitty.cc/dlvr/v1';

  /**
   * Verify a delivery receipt
   */
  static async verify(receiptId) {
    const response = await fetch(`${this.baseUrl}/verify/receipt/${receiptId}`);
    return response.json();
  }

  /**
   * Track a delivery
   */
  static async track(deliveryId) {
    const response = await fetch(`${this.baseUrl}/track/${deliveryId}`);
    return response.json();
  }

  /**
   * Get an embeddable receipt badge
   */
  static getBadge(receiptId, options = {}) {
    const { size = 'medium', theme = 'light' } = options;
    return {
      html: `<div class="chitty-receipt-badge" data-receipt="${receiptId}" data-size="${size}" data-theme="${theme}"></div>`,
      script: '<script src="https://cdn.chitty.cc/dlvr/badge.js"></script>',
      imageUrl: `https://cdn.chitty.cc/dlvr/badge/${receiptId}.svg?size=${size}&theme=${theme}`,
      verifyUrl: `https://chitty.cc/receipt/${receiptId}`
    };
  }

  /**
   * Get QR code for receipt verification
   */
  static getQRCode(receiptId, options = {}) {
    const { size = 200 } = options;
    return {
      url: `https://cdn.chitty.cc/dlvr/qr/${receiptId}.png?size=${size}`,
      verifyUrl: `https://chitty.cc/receipt/${receiptId}`
    };
  }

  /**
   * Get delivery timeline widget
   */
  static getTimeline(deliveryId) {
    return {
      html: `<div class="chitty-delivery-timeline" data-delivery="${deliveryId}"></div>`,
      script: '<script src="https://cdn.chitty.cc/dlvr/timeline.js"></script>',
      apiUrl: `${this.baseUrl}/timeline/${deliveryId}`
    };
  }
}

export default PublicReceipt;
