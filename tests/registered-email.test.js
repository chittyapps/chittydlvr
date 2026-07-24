/**
 * Registered Email Provider Tests
 * Verifies the RPost RMail client contract and the email channel wiring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChittyDLVR } from '../src/core/dlvr.js';
import {
  RPostRegisteredEmailClient,
  RouterRegisteredEmailClient,
  createRegisteredEmailClient
} from '../src/core/registered-email.js';

const BASE = 'https://webapi.r1.rpost.net';

function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function tokenRes(token = 'tok-1') {
  return jsonRes({ access_token: token, token_type: 'bearer', expires_in: 1209599 });
}

function sendRes(trackingId = 'TRACK-ABC') {
  return jsonRes({
    StatusCode: 200,
    Status: 'Success',
    Message: [{ Message: 'Request to send message received', MessageId: 'MAIL-1011' }],
    ResultContent: { TrackingId: trackingId }
  });
}

describe('createRegisteredEmailClient', () => {
  it('returns null when unconfigured', () => {
    expect(createRegisteredEmailClient({})).toBeNull();
    expect(createRegisteredEmailClient()).toBeNull();
  });

  it('prefers direct RPost credentials', () => {
    const client = createRegisteredEmailClient({
      RPOST_USERNAME: 'u@x.com',
      RPOST_PASSWORD: 'pw',
      CHITTYROUTER_REGISTERED_EMAIL_URL: 'https://router.chitty.cc/agents/notification'
    });
    expect(client).toBeInstanceOf(RPostRegisteredEmailClient);
    expect(client.mode).toBe('direct');
  });

  it('falls back to router delegation', () => {
    const client = createRegisteredEmailClient({
      CHITTYROUTER_REGISTERED_EMAIL_URL: 'https://router.chitty.cc/agents/notification/'
    });
    expect(client).toBeInstanceOf(RouterRegisteredEmailClient);
    expect(client.mode).toBe('router');
    expect(client.url).toBe('https://router.chitty.cc/agents/notification');
  });
});

describe('RPostRegisteredEmailClient', () => {
  let fetchMock;
  let client;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new RPostRegisteredEmailClient({
      username: 'u@x.com',
      password: 'pw',
      clientId: 'cid',
      appName: 'chittydlvr'
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('authenticates with the OAuth2 password grant and sends via /api/v1/Mail', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(sendRes());

    const result = await client.send({
      to: 'recipient@example.com',
      subject: 'Document Delivery: DM-1',
      body: '<p>hello</p>',
      customerTrackingId: 'DD-123',
      clientCode: 'DM-1'
    });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe(`${BASE}/token`);
    const form = new URLSearchParams(tokenInit.body);
    expect(form.get('grant_type')).toBe('password');
    expect(form.get('Client_Id')).toBe('cid');

    const [sendUrl, sendInit] = fetchMock.mock.calls[1];
    expect(sendUrl).toBe(`${BASE}/api/v1/Mail`);
    expect(sendInit.headers.Authorization).toBe('Bearer tok-1');
    const body = JSON.parse(sendInit.body);
    expect(body.To).toBe('recipient@example.com');
    expect(body.Body).toBe('<p>hello</p>');
    expect(body.Options['X-RPost-Type']).toBe('1');
    expect(body.Options['X-RPost-App']).toBe('chittydlvr');
    expect(body.Options['X-Rpost-CustomerTrackingId']).toBe('DD-123');
    expect(body.Options['X-RPost-ClientCode']).toBe('DM-1');

    expect(result.trackingId).toBe('TRACK-ABC');
    expect(result.status).toBe('Success');
  });

  it('caches the token across calls and refreshes on 401', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes('tok-old'))
      .mockResolvedValueOnce(sendRes('T1'))
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(tokenRes('tok-new'))
      .mockResolvedValueOnce(sendRes('T2'));

    await client.send({ to: 'a@b.com', subject: 's', body: 'b' });
    const second = await client.send({ to: 'a@b.com', subject: 's2', body: 'b2' });

    expect(second.trackingId).toBe('T2');
    // token, send, 401 send, re-token, retried send
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[4][1].headers.Authorization).toBe('Bearer tok-new');
  });

  it('throws on API-level failure', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(jsonRes({ Status: 'Failure' }));

    await expect(client.send({ to: 'a@b.com', subject: 's', body: 'b' }))
      .rejects.toThrow(/RPost send failed/);
  });

  it('retrieves message status by TrackingId', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(jsonRes({
        Status: 'Success',
        ResultContent: {
          Status: 'All Delivered',
          Recipients: [{ Address: 'a@b.com', DeliveryStatus: 'Delivered to Mailbox' }]
        }
      }));

    const status = await client.getStatus('TRACK-1');
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/api/v1/Receipt/MessageStatus`);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ TrackingId: 'TRACK-1' });
    expect(status.status).toBe('All Delivered');
    expect(status.recipients).toHaveLength(1);
  });
});

describe('email channel wiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('falls back to simulated dispatch without a provider', async () => {
    const dlvr = new ChittyDLVR({ apiKey: 'test-key-minimum-16ch' });
    expect(dlvr.registeredEmail).toBeNull();

    const dispatch = await dlvr.channels.dispatch({
      deliveryId: 'DD-1',
      method: 'email',
      address: 'a@b.com',
      mintId: 'DM-1',
      timestamp: new Date().toISOString()
    });

    expect(dispatch.dispatched).toBe(true);
    expect(dispatch.simulated).toBe(true);
    expect(dispatch.messageId).toBe('MSG-DD-1');
  });

  it('dispatches through the registered provider when configured', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce(sendRes('TRACK-XYZ'));
    vi.stubGlobal('fetch', fetchMock);

    const dlvr = new ChittyDLVR({
      apiKey: 'test-key-minimum-16ch',
      env: { RPOST_USERNAME: 'u@x.com', RPOST_PASSWORD: 'pw' }
    });
    expect(dlvr.registeredEmail).toBeInstanceOf(RPostRegisteredEmailClient);

    const dispatch = await dlvr.channels.dispatch({
      deliveryId: 'DD-2',
      method: 'email',
      address: 'a@b.com',
      mintId: 'DM-2',
      timestamp: new Date().toISOString()
    });

    expect(dispatch.dispatched).toBe(true);
    expect(dispatch.registered).toBe(true);
    expect(dispatch.simulated).toBeUndefined();
    expect(dispatch.trackingId).toBe('TRACK-XYZ');
    expect(dispatch.messageId).toBe('TRACK-XYZ');

    const sendBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sendBody.Options['X-Rpost-CustomerTrackingId']).toBe('DD-2');
    expect(sendBody.Options['X-RPost-ClientCode']).toBe('DM-2');
    expect(sendBody.Subject).toBe('Document Delivery: DM-2');
  });

  it('reports dispatch failure truthfully when the provider errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ error: 'invalid_grant' }, 400));
    vi.stubGlobal('fetch', fetchMock);

    const dlvr = new ChittyDLVR({
      apiKey: 'test-key-minimum-16ch',
      env: { RPOST_USERNAME: 'u@x.com', RPOST_PASSWORD: 'bad' }
    });

    const dispatch = await dlvr.channels.dispatch({
      deliveryId: 'DD-3',
      method: 'email',
      address: 'a@b.com',
      mintId: 'DM-3',
      timestamp: new Date().toISOString()
    });

    expect(dispatch.dispatched).toBe(false);
    expect(dispatch.error).toMatch(/RPost token request failed/);
  });

  it('delegates to chittyrouter when only the router endpoint is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonRes({
      ok: true,
      provider: 'rpost',
      status: 'Success',
      externalId: 'TRACK-ROUTER'
    }));
    vi.stubGlobal('fetch', fetchMock);

    const dlvr = new ChittyDLVR({
      apiKey: 'test-key-minimum-16ch',
      env: {
        CHITTYROUTER_REGISTERED_EMAIL_URL: 'https://router.chitty.cc/agents/notification',
        CHITTYROUTER_SERVICE_TOKEN: 'svc-token'
      }
    });

    const dispatch = await dlvr.channels.dispatch({
      deliveryId: 'DD-4',
      method: 'email',
      address: 'a@b.com',
      mintId: 'DM-4',
      timestamp: new Date().toISOString()
    });

    expect(dispatch.registered).toBe(true);
    expect(dispatch.providerMode).toBe('router');
    expect(dispatch.trackingId).toBe('TRACK-ROUTER');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://router.chitty.cc/agents/notification/registered-email/send');
    expect(init.headers.Authorization).toBe('Bearer svc-token');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('a@b.com');
    expect(body.idempotencyKey).toBe('DD-4');
  });
});
