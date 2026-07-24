/**
 * Registered Email Provider
 * Sends certified email through RPost RMail® so the email channel carries
 * third-party Registered Receipt® proof alongside ChittyDLVR's own signed receipts.
 * @canon chittycanon://core/services/chittydlvr
 *
 * Two modes:
 *  - direct: talk to the RMail REST API (token grant + /api/v1/Mail)
 *  - router: delegate to chittyrouter's NotificationAgent registered-email endpoint,
 *    which holds the RPost credentials centrally
 *
 * RMail API contract (verified against RPost's official Postman collection):
 *   POST {base}/token                        - OAuth2 password grant (form-urlencoded)
 *   POST {base}/api/v1/Mail                  - send -> ResultContent.TrackingId
 *   POST {base}/api/v1/Receipt/MessageStatus - status by TrackingId
 */

const DEFAULT_BASE_URL = 'https://webapi.r1.rpost.net';
const TOKEN_EXPIRY_MARGIN_MS = 60000;

export class RPostRegisteredEmailClient {
  constructor({ baseUrl, username, password, clientId, appName }) {
    this.mode = 'direct';
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.clientId = clientId || null;
    this.appName = appName || 'chittydlvr';
    this.tokenState = null;
  }

  async getAccessToken() {
    if (this.tokenState && this.tokenState.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
      return this.tokenState.token;
    }

    const form = new URLSearchParams({
      grant_type: 'password',
      username: this.username,
      password: this.password
    });
    if (this.clientId) form.set('Client_Id', this.clientId);

    const res = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });

    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }

    if (!res.ok || !parsed?.access_token) {
      throw new Error(`RPost token request failed (${res.status}): ${text.slice(0, 300)}`);
    }

    this.tokenState = {
      token: parsed.access_token,
      expiresAt: Date.now() + (parsed.expires_in ? parsed.expires_in * 1000 : 3600000)
    };
    return this.tokenState.token;
  }

  async authorizedFetch(path, init = {}) {
    let token = await this.getAccessToken();
    let res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      this.tokenState = null;
      token = await this.getAccessToken();
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...(init.headers || {}), 'Authorization': `Bearer ${token}` }
      });
    }
    return res;
  }

  /**
   * Send a Registered Email™ message.
   * Returns { trackingId, status, raw }.
   */
  async send({ to, cc, bcc, from, subject, body, customerTrackingId, clientCode, options }) {
    const sendOptions = {
      'X-RPost-Type': '1',
      'X-RPost-App': this.appName,
      ...(customerTrackingId ? { 'X-Rpost-CustomerTrackingId': customerTrackingId } : {}),
      ...(clientCode ? { 'X-RPost-ClientCode': clientCode.slice(0, 64) } : {}),
      ...(options || {})
    };

    const res = await this.authorizedFetch('/api/v1/Mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: from || '',
        To: to,
        Cc: cc || '',
        Bcc: bcc || '',
        Subject: subject,
        Body: body,
        Attachments: [],
        IsLargeMail: false,
        Options: sendOptions
      })
    });

    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }

    if (!res.ok || parsed?.Status === 'Failure') {
      throw new Error(`RPost send failed (${res.status}): ${text.slice(0, 300)}`);
    }

    return {
      trackingId: parsed?.ResultContent?.TrackingId || null,
      status: parsed?.Status || 'submitted',
      raw: parsed
    };
  }

  /**
   * Retrieve delivery status for a tracking id.
   */
  async getStatus(trackingId) {
    const res = await this.authorizedFetch('/api/v1/Receipt/MessageStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TrackingId: trackingId })
    });

    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }

    if (!res.ok) {
      throw new Error(`RPost status failed (${res.status}): ${text.slice(0, 300)}`);
    }

    return {
      trackingId,
      status: parsed?.ResultContent?.Status || parsed?.Status || 'unknown',
      recipients: parsed?.ResultContent?.Recipients || [],
      raw: parsed
    };
  }
}

/**
 * Delegates registered sends to chittyrouter's NotificationAgent, which owns
 * the RPost credentials. Endpoint: POST {url} with the agent's send payload.
 */
export class RouterRegisteredEmailClient {
  constructor({ url, token, accountId }) {
    this.mode = 'router';
    this.url = url.replace(/\/$/, '');
    this.token = token || null;
    this.accountId = accountId || undefined;
  }

  headers() {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
    };
  }

  async send({ to, cc, bcc, from, subject, body, customerTrackingId, clientCode, options }) {
    const res = await fetch(`${this.url}/registered-email/send`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        accountId: this.accountId,
        to,
        cc,
        bcc,
        from,
        subject,
        bodyHtml: body,
        idempotencyKey: customerTrackingId,
        features: clientCode ? { clientCode: clientCode.slice(0, 64) } : undefined,
        options
      })
    });

    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }

    if (!res.ok || !parsed?.ok) {
      throw new Error(`Router registered send failed (${res.status}): ${text.slice(0, 300)}`);
    }

    return {
      trackingId: parsed.externalId || null,
      status: parsed.status || 'submitted',
      raw: parsed
    };
  }

  async getStatus(trackingId) {
    const res = await fetch(
      `${this.url}/registered-email/status?externalId=${encodeURIComponent(trackingId)}`,
      { headers: this.headers() }
    );

    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }

    if (!res.ok) {
      throw new Error(`Router registered status failed (${res.status}): ${text.slice(0, 300)}`);
    }

    return {
      trackingId,
      status: parsed?.status || 'unknown',
      recipients: parsed?.recipients || [],
      raw: parsed
    };
  }
}

/**
 * Build a registered email client from worker env, or null when unconfigured
 * (the email channel then falls back to simulated dispatch).
 */
export function createRegisteredEmailClient(env = {}) {
  if (env.RPOST_USERNAME && env.RPOST_PASSWORD) {
    return new RPostRegisteredEmailClient({
      baseUrl: env.RPOST_BASE_URL,
      username: env.RPOST_USERNAME,
      password: env.RPOST_PASSWORD,
      clientId: env.RPOST_CLIENT_ID,
      appName: env.SERVICE_NAME || 'chittydlvr'
    });
  }
  if (env.CHITTYROUTER_REGISTERED_EMAIL_URL) {
    return new RouterRegisteredEmailClient({
      url: env.CHITTYROUTER_REGISTERED_EMAIL_URL,
      token: env.CHITTYROUTER_SERVICE_TOKEN,
      accountId: env.CHITTYROUTER_REGISTERED_EMAIL_ACCOUNT
    });
  }
  return null;
}

export default createRegisteredEmailClient;
