/* global AbortSignal, URL, URLSearchParams */
import { setTimeout as delay } from 'node:timers/promises';

const ISSUER = 'https://dev-0kihwasowi558bwz.us.auth0.com';
const CLIENT = 'flc6QWfj6uktmj9APT14sMYWULyEVFTg';

// Tokens and device codes stay inside this process; only the user code is displayed.
export async function deviceLogin({ fetchImpl = globalThis.fetch, sleep = delay, now = Date.now,
  stopped = async () => false, announce = () => {} } = {}) {
  const post = async (path, fields) => {
    if (await stopped()) throw new Error('Login stopped.');
    const response = await fetchImpl(`${ISSUER}${path}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT, ...fields }).toString(),
    });
    return { ok: response.ok, body: await response.json() };
  };
  const started = now();
  const initial = await post('/oauth/device/code', {
    audience: 'https://api.housepoints.app', scope: 'openid profile email',
  });
  const data = initial.body;
  if (!initial.ok || typeof data.device_code !== 'string' || !data.device_code ||
    typeof data.user_code !== 'string' || !/^[A-Z0-9-]{4,32}$/.test(data.user_code) ||
    !Number.isInteger(data.expires_in) || data.expires_in <= 0 ||
    (data.interval !== undefined && (!Number.isInteger(data.interval) || data.interval <= 0))) {
    throw new Error('Invalid device authorization response.');
  }
  const uri = new URL(data.verification_uri);
  if (uri.origin !== ISSUER || uri.username || uri.password || uri.search || uri.hash) {
    throw new Error('Unexpected verification destination.');
  }
  const deadline = started + Math.min(data.expires_in, 900) * 1000;
  let interval = (data.interval ?? 5) * 1000;
  announce({ verificationUri: uri.href, userCode: data.user_code });
  while (now() < deadline) {
    // Short chunks let the STOP file interrupt a long provider backoff.
    const wake = now() + interval;
    while (now() < wake) {
      if (await stopped()) throw new Error('Login stopped.');
      if (now() >= deadline) throw new Error('Device login expired.');
      await sleep(Math.min(1000, wake - now(), deadline - now()));
    }
    if (now() >= deadline) break;
    const result = await post('/oauth/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: data.device_code,
    });
    if (await stopped() || now() >= deadline) throw new Error('Login stopped or expired.');
    if (result.ok) {
      if (typeof result.body.access_token !== 'string' || !result.body.access_token ||
        result.body.token_type?.toLowerCase() !== 'bearer' || result.body.refresh_token ||
        !Number.isFinite(result.body.expires_in) || result.body.expires_in <= 0) {
        throw new Error('Unexpected token response.');
      }
      return result.body.access_token;
    }
    if (result.body.error === 'authorization_pending') continue;
    if (result.body.error === 'slow_down') { interval += 5000; continue; }
    // Never expose error descriptions, which can contain provider/user data.
    throw new Error('Device authorization rejected.');
  }
  throw new Error('Device login expired.');
}
