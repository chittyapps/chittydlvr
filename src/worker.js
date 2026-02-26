/**
 * ChittyDLVR Worker
 * Cloudflare Worker entry point
 */

import { ChittyDLVR } from './core/dlvr.js';

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      console.log(`ChittyDLVR queue event: ${JSON.stringify(message.body)}`);
      message.ack();
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check (both /health and /dlvr/health for api.chitty.cc route)
    if (url.pathname === '/health' || url.pathname === '/dlvr/health') {
      return Response.json({
        service: 'ChittyDLVR',
        status: 'healthy',
        version: env.VERSION || '1.0.0',
        tagline: 'Delivered. Confirmed. Defended.',
        timestamp: new Date().toISOString()
      });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    const dlvr = new ChittyDLVR({
      apiKey: env.API_KEY,
      chittyId: env.CHITTY_ID
    });
    await dlvr.initialize();

    try {
      return await handleRequest(url, request, dlvr, env);
    } catch (error) {
      return Response.json(
        { error: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  }
};

async function handleRequest(url, request, dlvr, env) {
  const path = url.pathname;

  // Public routes (no auth)
  if (path.startsWith('/verify/') || path.startsWith('/track/')) {
    return handlePublicRoute(path, dlvr);
  }

  // Auth required for everything else
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // API routes
  if (request.method === 'POST' && path === '/dlvr/v1/send') {
    const body = await request.json();
    const result = await dlvr.send(body);
    return Response.json(result, { status: 201 });
  }

  if (request.method === 'GET' && path.startsWith('/dlvr/v1/status/')) {
    const deliveryId = path.split('/').pop();
    const result = await dlvr.status(deliveryId);
    return Response.json(result);
  }

  if (request.method === 'POST' && path.match(/\/dlvr\/v1\/confirm\/.+/)) {
    const deliveryId = path.split('/').pop();
    const body = await request.json();
    const result = await dlvr.confirm(deliveryId, body);
    return Response.json(result);
  }

  if (request.method === 'POST' && path.match(/\/dlvr\/v1\/receipt\/.+/)) {
    const deliveryId = path.split('/').pop();
    const body = await request.json();
    const result = await dlvr.receipt(deliveryId, body);
    return Response.json(result, { status: 201 });
  }

  if (request.method === 'POST' && path === '/dlvr/v1/serve') {
    const body = await request.json();
    const result = await dlvr.serve(body.mintId, body);
    return Response.json(result, { status: 201 });
  }

  if (request.method === 'POST' && path === '/dlvr/v1/bulk') {
    const body = await request.json();
    const result = await dlvr.bulkSend(body);
    return Response.json(result, { status: 201 });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

async function handlePublicRoute(path, dlvr) {
  if (path.startsWith('/verify/receipt/')) {
    const receiptId = path.split('/').pop();
    const result = await dlvr.receipts.verify(receiptId);
    return Response.json(result);
  }

  if (path.startsWith('/track/')) {
    const deliveryId = path.split('/').pop();
    const result = await dlvr.status(deliveryId);
    return Response.json(result);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
