/* global Response */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, executePlan, requestFor } from './beta-workload.mjs';

const plan = {
  apiOrigin: 'https://housepointsapi-beta.up.railway.app',
  runId: '1621bc12-2b8c-4aec-8bbb-11afff293628',
  organizationSlug: 'b1-synthetic-rehearsal', allowedRecipients: ['synthetic-recipient'], intervalSeconds: 10,
  actions: [{ kind: 'summary' }, { kind: 'award', targetUserId: 'synthetic-recipient', categoryId: 'synthetic-category' }],
};
const match = () => Response.json({ status: 'MATCH', organizationSlug: plan.organizationSlug });

test('rejects production, unexpected organizations, recipients, and excessive load', () => {
  for (const changes of [
    { apiOrigin: 'https://housepointsapi-production.up.railway.app' },
    { organizationSlug: 'real-organization' }, { allowedRecipients: [] },
    { intervalSeconds: 1 }, { actions: Array(101).fill({ kind: 'summary' }) },
  ]) assert.throws(() => validatePlan({ ...plan, ...changes }));
});

test('retries an uncertain award with identical body/key and never redirects credentials', async () => {
  const awardPlan = { ...plan, actions: [plan.actions[1]] };
  const bodies = []; const pauses = [];
  const totals = await executePlan(awardPlan, {
    token: 'fake', sleep: async ms => pauses.push(ms),
    fetchImpl: async (url, init) => {
      assert.equal(init.redirect, 'error');
      if (url.endsWith('/orgs/route-context')) return match();
      bodies.push(init.body);
      if (bodies.length === 1) throw new Error('Response lost after commit');
      return Response.json({ ok: true });
    },
  });
  assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1]);
  assert.equal(totals.succeeded, 1); assert.equal(totals.retries, 1);
  assert.deepEqual(pauses, [10000]);
  assert.notEqual(requestFor({ ...awardPlan, actions: [plan.actions[1], plan.actions[1]] }, 0).body.idempotencyKey,
    requestFor({ ...awardPlan, actions: [plan.actions[1], plan.actions[1]] }, 1).body.idempotencyKey);
});

test('scope mismatch prevents workload requests', async () => {
  let calls = 0;
  await assert.rejects(executePlan(plan, { token: 'fake', fetchImpl: async () => {
    calls++; return Response.json({ status: 'MATCH', organizationSlug: 'different' });
  } }), /Organization mismatch/);
  assert.equal(calls, 1);
});

test('401, 403 and throttling stop immediately without retry', async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    await assert.rejects(executePlan(plan, { token: 'fake', fetchImpl: async url => {
      if (url.endsWith('/orgs/route-context')) return match();
      calls++; return new Response('', { status });
    } }), /Request rejected/);
    assert.equal(calls, 1);
  }
});

test('three failures halt the run and preserve aggregate evidence', async () => {
  let calls = 0; const events = [];
  await assert.rejects(executePlan(plan, { token: 'fake', sleep: async () => {}, record: async event => events.push(event), fetchImpl: async url => {
    if (url.endsWith('/orgs/route-context')) return match();
    calls++; return new Response('', { status: 503 });
  } }), /Three consecutive/);
  assert.equal(calls, 3); assert.equal(events.at(-1).totals.succeeded, 0);
});

test('stop switch prevents any request', async () => {
  await assert.rejects(executePlan(plan, { token: 'fake', stopped: async () => true,
    fetchImpl: async () => assert.fail('must not send'),
  }), /Stop requested/);
});
