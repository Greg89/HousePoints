/* global URLSearchParams */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceLogin } from './beta-device-login.mjs';

const initial = { device_code: 'private-device-code', user_code: 'ABCD-EFGH',
  verification_uri: 'https://dev-0kihwasowi558bwz.us.auth0.com/activate', expires_in: 120, interval: 5 };
const success = { access_token: 'private-access-token', token_type: 'Bearer', expires_in: 3600 };
function harness(responses, overrides = {}) {
  let time = 0;
  const calls = [], notices = [];
  return { calls, notices, options: {
    now: () => time, sleep: async ms => { time += ms; },
    announce: info => notices.push(info),
    fetchImpl: async (url, options) => {
      calls.push({ url, options, at: time });
      assert.ok(responses.length, 'unexpected extra request');
      const body = responses.shift();
      return { ok: !body.error, json: async () => body };
    }, ...overrides,
  } };
}
test('pins audience and scope, respects pending and persistent slowdown, never announces secrets', async () => {
  const h = harness([initial, { error: 'authorization_pending' }, { error: 'slow_down' }, success]);
  assert.equal(await deviceLogin(h.options), success.access_token);
  assert.deepEqual(h.calls.map(c => c.at), [0, 5000, 10000, 20000]);
  const params = new URLSearchParams(h.calls[0].options.body);
  assert.equal(params.get('audience'), 'https://api.housepoints.app');
  assert.equal(params.get('scope'), 'openid profile email');
  assert.equal(params.get('client_id'), 'flc6QWfj6uktmj9APT14sMYWULyEVFTg');
  assert.equal(h.calls[1].options.redirect, 'error');
  assert.deepEqual(h.notices, [{ verificationUri: initial.verification_uri, userCode: initial.user_code }]);
});
test('denial stops polling and suppresses provider error text', async () => {
  const h = harness([initial, { error: 'access_denied', error_description: 'SECRET' }]);
  await assert.rejects(deviceLogin(h.options), { message: 'Device authorization rejected.' });
  assert.equal(h.calls.length, 2);
});
test('expires before polling when interval exceeds lifetime', async () => {
  const h = harness([{ ...initial, expires_in: 2 }]);
  await assert.rejects(deviceLogin(h.options), /expired/);
  assert.equal(h.calls.length, 1);
});
test('rejects foreign verification destinations before announcing', async () => {
  const h = harness([{ ...initial, verification_uri: 'https://example.com/activate' }]);
  await assert.rejects(deviceLogin(h.options), /destination/);
  assert.equal(h.notices.length, 0);
});
test('STOP prevents all network activity', async () => {
  const h = harness([], { stopped: async () => true });
  await assert.rejects(deviceLogin(h.options), /stopped/);
  assert.equal(h.calls.length, 0);
});
test('unexpected refresh token is rejected', async () => {
  const h = harness([initial, { ...success, refresh_token: 'unexpected' }]);
  await assert.rejects(deviceLogin(h.options), /Unexpected token/);
});
test('invalid polling interval is rejected', async () => {
  const h = harness([{ ...initial, interval: -1 }]);
  await assert.rejects(deviceLogin(h.options), /Invalid device/);
});
