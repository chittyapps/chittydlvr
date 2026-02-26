/**
 * ChittyDLVR
 * "Delivered. Confirmed. Defended."
 *
 * Certified delivery with cryptographic proof of receipt.
 * Every delivery tracked, every receipt signed, every moment witnessed.
 *
 * @example
 * import { ChittyDLVR } from '@chitty/dlvr';
 *
 * const dlvr = new ChittyDLVR({ apiKey: 'your-key' });
 *
 * // Send a certified delivery
 * const delivery = await dlvr.send({
 *   mintId: 'DM-ABC123',
 *   to: 'recipient-chitty-id',
 *   method: 'email',
 *   address: 'recipient@example.com'
 * });
 *
 * // Check delivery status
 * const status = await dlvr.status(delivery.deliveryId);
 * // status.receipt → signed receipt with timestamp
 * // status.proof → delivery pillar score updated
 */

// Core
export { ChittyDLVR } from './core/dlvr.js';
export { DeliveryChannel } from './core/channels.js';
export { ReceiptEngine } from './core/receipt.js';
export { ServiceEngine } from './core/service.js';

// SDK Client
export { DLVRClient, DLVRError } from './sdk/client.js';

// Public verification
export { PublicReceipt } from './verify/public.js';

// Default export
export { ChittyDLVR as default } from './core/dlvr.js';

// Version
export const VERSION = '1.0.0';

// Delivery methods
export const DELIVERY_METHODS = [
  'email',         // Certified email with read receipt
  'sms',           // SMS with delivery confirmation
  'portal',        // ChittyPortal secure delivery
  'api',           // API webhook delivery
  'physical',      // Physical mail tracking (USPS/FedEx)
  'inPerson',      // In-person with witness attestation
  'legalService'   // Process server / legal service
];

// Delivery statuses
export const DELIVERY_STATUSES = [
  'PENDING',       // Created, not yet sent
  'SENT',          // Dispatched via channel
  'DELIVERED',     // Channel confirmed delivery
  'OPENED',        // Recipient opened/viewed
  'ACKNOWLEDGED',  // Recipient explicitly acknowledged
  'RECEIPTED',     // Cryptographic receipt signed
  'FAILED',        // Delivery failed
  'BOUNCED',       // Bounced back
  'REFUSED'        // Recipient refused delivery
];
