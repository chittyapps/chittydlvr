/**
 * ChittyDLVR Worker
 * Cloudflare Worker entry point
 * @canon chittycanon://core/services/chittydlvr
 */

import { ChittyDLVR } from './core/dlvr.js';

const ALLOWED_ORIGINS = [
  'https://dlvr.chitty.cc',
  'https://api.chitty.cc',
  'https://portal.chitty.cc',
  'https://chitty.cc'
];

function getCorsOrigin(request) {
  const origin = request?.headers?.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function jsonResponse(data, status = 200, request = null) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getCorsOrigin(request)
    }
  });
}

async function parseJSON(request) {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return { error: jsonResponse({ error: 'Invalid JSON in request body' }, 400) };
  }
}

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }

  const token = authHeader.substring(7);
  if (!token) return { valid: false };

  const validKey = env.CHITTY_AUTH_SERVICE_TOKEN;
  if (!validKey) {
    console.error('CHITTY_AUTH_SERVICE_TOKEN not configured in environment');
    return { valid: false };
  }

  // Constant-time comparison: hash both to fixed-length then XOR
  // Hashing ensures comparison time is independent of key length
  const encoder = new TextEncoder();
  const tokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
  const keyHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(validKey)));
  let mismatch = 0;
  for (let i = 0; i < tokenHash.length; i++) {
    mismatch |= tokenHash[i] ^ keyHash[i];
  }
  if (mismatch !== 0) return { valid: false };

  return { valid: true, chittyId: env.CHITTY_ID || 'authenticated' };
}

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        console.log(`ChittyDLVR queue event: ${JSON.stringify(message.body)}`);
        message.ack();
      } catch (error) {
        console.error('Queue message processing failed:', error.message);
        message.retry({ delaySeconds: 30 });
      }
    }
  },

  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // Health check
      if (url.pathname === '/health' || url.pathname === '/dlvr/health') {
        return jsonResponse({
          service: 'ChittyDLVR',
          status: 'ok',
          version: env.VERSION || '1.0.0',
          tagline: 'Delivered. Confirmed. Defended.',
          timestamp: new Date().toISOString()
        });
      }

      // Service status metadata
      if (url.pathname === '/api/v1/status') {
        return jsonResponse({
          name: 'ChittyDLVR',
          version: env.VERSION || '1.0.0',
          environment: env.ENVIRONMENT || 'production',
          description: 'Certified delivery with cryptographic proof of receipt',
          uri: 'chittycanon://core/services/chittydlvr',
          tier: 4
        });
      }

      // CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': getCorsOrigin(request),
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
          }
        });
      }

      if (!env.INTERNAL_API_KEY) {
        console.error('INTERNAL_API_KEY not configured in environment');
        return jsonResponse({ error: 'Service misconfigured' }, 503);
      }
      const dlvr = new ChittyDLVR({
        apiKey: env.INTERNAL_API_KEY,
        chittyId: env.CHITTY_ID,
        signingKeyJwk: env.SIGNING_KEY_JWK
      });
      await dlvr.initialize();

      return await handleRequest(url, request, dlvr, env);
    } catch (error) {
      console.error('ChittyDLVR Worker error:', error.message, error.stack);
      return jsonResponse({ error: 'Internal server error', code: 'WORKER_ERROR' }, 500);
    }
  }
};

async function handleRequest(url, request, dlvr, env) {
  const path = url.pathname;

  // Public routes (no auth)
  if (path.startsWith('/verify/') || path.startsWith('/track/')) {
    return handlePublicRoute(path, request, dlvr);
  }

  // Auth required for everything else
  const auth = await authenticate(request, env);
  if (!auth.valid) {
    return jsonResponse({ error: 'Unauthorized' }, 401, request);
  }

  // POST /dlvr/v1/send
  if (request.method === 'POST' && path === '/dlvr/v1/send') {
    const body = await parseJSON(request);
    if (body.error) return body.error;

    if (!body.data.mintId || typeof body.data.mintId !== 'string') {
      return jsonResponse({ error: 'Missing required field: mintId' }, 400, request);
    }

    const result = await dlvr.send({ ...body.data, chittyId: auth.chittyId });
    return jsonResponse(result, 201, request);
  }

  // GET /dlvr/v1/status/:id
  if (request.method === 'GET' && path.startsWith('/dlvr/v1/status/')) {
    const deliveryId = path.split('/').pop();
    if (!/^DD-/.test(deliveryId)) {
      return jsonResponse({ error: 'Invalid delivery ID format' }, 400, request);
    }
    const result = await dlvr.status(deliveryId);
    return jsonResponse(result, 200, request);
  }

  // POST /dlvr/v1/confirm/:id
  if (request.method === 'POST' && path.match(/\/dlvr\/v1\/confirm\/[^/]+$/)) {
    const deliveryId = path.split('/').pop();
    if (!/^DD-/.test(deliveryId)) {
      return jsonResponse({ error: 'Invalid delivery ID format' }, 400, request);
    }
    const body = await parseJSON(request);
    if (body.error) return body.error;

    const result = await dlvr.confirm(deliveryId, body.data);
    return jsonResponse(result, 200, request);
  }

  // POST /dlvr/v1/receipt/:id
  if (request.method === 'POST' && path.match(/\/dlvr\/v1\/receipt\/[^/]+$/)) {
    const deliveryId = path.split('/').pop();
    if (!/^DD-/.test(deliveryId)) {
      return jsonResponse({ error: 'Invalid delivery ID format' }, 400, request);
    }
    const body = await parseJSON(request);
    if (body.error) return body.error;

    if (!body.data.signer || typeof body.data.signer !== 'string') {
      return jsonResponse({ error: 'Missing required field: signer' }, 400, request);
    }

    const result = await dlvr.receipt(deliveryId, body.data);
    return jsonResponse(result, 201, request);
  }

  // POST /dlvr/v1/serve
  if (request.method === 'POST' && path === '/dlvr/v1/serve') {
    const body = await parseJSON(request);
    if (body.error) return body.error;

    if (!body.data.mintId || typeof body.data.mintId !== 'string') {
      return jsonResponse({ error: 'Missing required field: mintId' }, 400, request);
    }
    if (!body.data.respondent || typeof body.data.respondent !== 'string') {
      return jsonResponse({ error: 'Missing required field: respondent' }, 400, request);
    }

    const result = await dlvr.serve(body.data.mintId, body.data);
    return jsonResponse(result, 201, request);
  }

  // POST /dlvr/v1/bulk
  if (request.method === 'POST' && path === '/dlvr/v1/bulk') {
    const body = await parseJSON(request);
    if (body.error) return body.error;

    if (!body.data.mintId || typeof body.data.mintId !== 'string') {
      return jsonResponse({ error: 'Missing required field: mintId' }, 400, request);
    }
    if (!Array.isArray(body.data.recipients) || body.data.recipients.length === 0) {
      return jsonResponse({ error: 'Missing required field: recipients (non-empty array)' }, 400, request);
    }

    const result = await dlvr.bulkSend(body.data);
    return jsonResponse(result, 201, request);
  }

  return jsonResponse({ error: 'Not found' }, 404, request);
}

async function handlePublicRoute(path, request, dlvr) {
  try {
    if (path.startsWith('/verify/receipt/')) {
      const receiptId = path.split('/').pop();
      if (!/^DR-/.test(receiptId)) {
        return jsonResponse({ error: 'Invalid receipt ID format' }, 400, request);
      }
      // Look up receipt data, then verify signature
      const receiptData = dlvr.receipts.getById(receiptId);
      const result = await dlvr.receipts.verify(receiptId, receiptData);
      return jsonResponse(result, 200, request);
    }

    if (path.startsWith('/track/')) {
      const deliveryId = path.split('/').pop();
      if (!/^DD-/.test(deliveryId)) {
        return jsonResponse({ error: 'Invalid delivery ID format' }, 400, request);
      }
      const result = await dlvr.status(deliveryId);
      return jsonResponse(result, 200, request);
    }

    return jsonResponse({ error: 'Not found' }, 404, request);
  } catch (error) {
    console.error('Public route error:', error.message);
    return jsonResponse({ error: 'Internal server error' }, 500, request);
  }
}
