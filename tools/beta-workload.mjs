/* global console, process, AbortSignal */
import { createHash } from 'node:crypto';
import { readFile, open, mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const ORIGIN = 'https://housepointsapi-beta.up.railway.app';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePlan(plan) {
  if (!plan || plan.apiOrigin !== ORIGIN || !uuid.test(plan.runId ?? '')) throw new Error('Expected beta origin and a UUID v4 runId.');
  if (!/^b1-synthetic-[a-z0-9-]+$/.test(plan.organizationSlug ?? '')) throw new Error('Expected a dedicated b1-synthetic organization.');
  if (!Array.isArray(plan.allowedRecipients) || plan.allowedRecipients.some(id => typeof id !== 'string' || !id)) throw new Error('Invalid recipient allowlist.');
  if (!Number.isInteger(plan.intervalSeconds) || plan.intervalSeconds < 10 || plan.intervalSeconds > 300) throw new Error('Interval must be 10–300 seconds.');
  if (!Array.isArray(plan.actions) || !plan.actions.length || plan.actions.length > 100 || plan.actions.length * plan.intervalSeconds > 1800) throw new Error('Plan must contain 1–100 actions within 30 minutes.');
  for (const action of plan.actions) {
    if (action.kind === 'summary') continue;
    if (action.kind !== 'award' || !plan.allowedRecipients.includes(action.targetUserId) || typeof action.categoryId !== 'string' || !action.categoryId) throw new Error('Invalid or non-allowlisted award.');
  }
  return plan;
}

export function requestFor(plan, index) {
  const action = plan.actions[index];
  if (action.kind === 'summary') return { path: '/dashboard/summary', body: {} };
  // Stable across transport retries; the run journal prevents re-executing a run.
  const hex = createHash('sha256').update(`${plan.runId}:${index}`).digest('hex');
  const key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return { path: '/points/adjust', body: {
    targetUserId: action.targetUserId, categoryId: action.categoryId,
    categoryApiVersion: 'categories-v1', delta: 1,
    reason: 'B1 synthetic workload', idempotencyKey: key,
  } };
}

export async function executePlan(plan, { token, fetchImpl = globalThis.fetch, sleep = delay, stopped = async () => false, record = async () => {} }) {
  validatePlan(plan);
  if (!token) throw new Error('B1_ACCESS_TOKEN must contain a normal synthetic-user access token.');
  const totals = { planned: plan.actions.length, attempted: 0, succeeded: 0, retries: 0, failed: 0 };
  const deadline = Date.now() + 30 * 60 * 1000;
  const shouldStop = async () => Date.now() >= deadline || await stopped();
  let consecutiveErrors = 0;
  const post = async (path, body) => {
    if (await shouldStop()) throw new Error('Stop requested or time budget exhausted.');
    const response = await fetchImpl(`${ORIGIN}${path}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-housepoints-organization-slug': plan.organizationSlug },
      body: JSON.stringify(body),
    });
    return response;
  };
  const verifyScope = async () => {
    const response = await post('/orgs/route-context', { slug: plan.organizationSlug });
    if (!response.ok) throw new Error(`Scope preflight failed (${response.status}).`);
    const context = await response.json();
    if (context.status !== 'MATCH' || context.organizationSlug !== plan.organizationSlug) throw new Error('Organization mismatch or unavailable membership.');
  };
  try {
    await verifyScope();
    for (let index = 0; index < plan.actions.length; index++) {
      if (await shouldStop()) throw new Error('Stop requested or time budget exhausted.');
      const request = requestFor(plan, index);
      if (plan.actions[index].kind === 'award') await verifyScope();
      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) { totals.retries++; await sleep(plan.intervalSeconds * 1000); }
        if (await shouldStop()) throw new Error('Stop requested or time budget exhausted.');
        totals.attempted++;
        let status = 0;
        try {
          const response = await post(request.path, request.body);
          status = response.status;
          await response.body?.cancel(); // Do not persist member or ledger response data.
        } catch {
          // An uncertain response may have committed. Reuse the exact same key/body.
        }
        await record({ index, attempt: attempt + 1, kind: plan.actions[index].kind, status });
        if (status >= 200 && status < 300) { success = true; consecutiveErrors = 0; break; }
        if (status >= 400 && status < 500) throw new Error(`Request rejected (${status}); stopping without retry.`);
        consecutiveErrors++;
        if (consecutiveErrors >= 3) throw new Error('Three consecutive transport/server failures; stopping.');
      }
      if (!success) throw new Error('Retry budget exhausted.');
      totals.succeeded++;
      if (index < plan.actions.length - 1) await sleep(plan.intervalSeconds * 1000);
    }
    return totals;
  } catch (error) {
    totals.failed++;
    await record({ outcome: 'stopped', totals });
    throw error;
  }
}

async function main() {
  const [file, mode] = process.argv.slice(2);
  if (!file || (mode && mode !== '--execute')) throw new Error('Usage: node tools/beta-workload.mjs plan.json [--execute]');
  const plan = validatePlan(JSON.parse(await readFile(file, 'utf8')));
  if (mode !== '--execute') {
    console.log(JSON.stringify({ mode: 'dry-run', ...plan, requests: plan.actions.map((_, i) => requestFor(plan, i)) }, null, 2));
    return;
  }
  if (!process.env.B1_ACCESS_TOKEN) throw new Error('Missing B1_ACCESS_TOKEN.');
  const journalPath = resolve('artifacts/railway-beta', `${plan.runId}.jsonl`);
  await mkdir(dirname(journalPath), { recursive: true });
  const journal = await open(journalPath, 'wx');
  let interrupted = false;
  const stop = () => { interrupted = true; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const record = async event => journal.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
  try {
    await record({ runId: plan.runId, planHash: createHash('sha256').update(JSON.stringify(plan)).digest('hex'), outcome: 'started' });
    const totals = await executePlan(plan, {
      token: process.env.B1_ACCESS_TOKEN, record,
      stopped: async () => interrupted || await access(resolve('artifacts/railway-beta/STOP')).then(() => true, () => false),
    });
    await record({ outcome: 'complete', totals });
    console.log(JSON.stringify(totals));
  } finally {
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
    await journal.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Workload stopped. Check the plan, authentication, and local run journal; no automatic resume.'); process.exitCode = 1; });
}
