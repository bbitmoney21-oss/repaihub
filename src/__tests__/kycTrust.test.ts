// Vitest — the API must never trust client-writable verification flags.
// No network, no DB: supabaseAdmin is replaced by an in-memory fake.
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { AddressInfo } from 'node:net';

// ── fake supabase ────────────────────────────────────────────────────────────
type Result = { data: unknown; error: { message: string } | null };
type Call = { table: string; ops: Array<[string, unknown[]]> };
const state: { tables: Record<string, Result | ((c: Call) => Result)>; calls: Call[] } = { tables: {}, calls: [] };

function builder(table: string) {
  const call: Call = { table, ops: [] };
  state.calls.push(call);
  const resolve = (): Result => {
    const t = state.tables[table];
    if (typeof t === 'function') return t(call);
    return t ?? { data: null, error: null };
  };
  const b: Record<string | symbol, unknown> = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (ok: (v: Result) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, ko);
      if (prop === 'maybeSingle' || prop === 'single') return () => { call.ops.push([String(prop), []]); return Promise.resolve(resolve()); };
      return (...args: unknown[]) => { call.ops.push([String(prop), args]); return b; };
    },
  });
  return b;
}
const fakeAdmin = {
  from: (t: string) => builder(t),
  auth: { signInWithPassword: async () => ({ data: null, error: { message: 'no' } }) },
};
vi.mock('../lib/supabaseServer', () => ({ supabaseAdmin: fakeAdmin, supabaseAdminConfigured: true }));
vi.mock('../lib/supabaseServer.js', () => ({ supabaseAdmin: fakeAdmin, supabaseAdminConfigured: true }));
vi.mock('../services/auditService', () => ({ log: vi.fn() }));
vi.mock('../services/auditService.js', () => ({ log: vi.fn() }));

process.env.JWT_SECRET = 'test-secret-not-used-anywhere-else';
const USER = '00000000-0000-4000-8000-000000000001';
const token = jwt.sign({ id: USER, email: 'qa+028@example.test' }, process.env.JWT_SECRET);

const { deriveKycState, getVerifiedKycState, getVerifiedKycStateOrUnverified, KycStateUnavailableError } =
  await import('../services/kycState');
const authRoutes = (await import('../routes/auth')).default;
const usersRoutes = (await import('../routes/users')).default;
const webhookRoutes = (await import('../routes/webhooks')).default;

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/webhooks', webhookRoutes);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
afterAll(() => server.close());

const NOW = new Date();
const future = new Date(NOW.getTime() + 365 * 864e5).toISOString();
const past = new Date(NOW.getTime() - 864e5).toISOString();
const verifiedProfile = {
  kycStatus: 'verified', canadaVerified: true, indiaVerified: true, kycVerifiedAt: past, kycExpiresAt: future,
};
// what a user could write into kyc_submissions before 028
const forgedKycRow = { user_id: USER, canada_verified: true, india_verified: true };

beforeEach(() => { state.tables = {}; state.calls = []; });

// ── unit: deriveKycState ─────────────────────────────────────────────────────
describe('deriveKycState (pure)', () => {
  it('null row → unverified', () => {
    expect(deriveKycState(null)).toEqual({ canadaVerified: false, indiaVerified: false, fullyVerified: false, expired: false });
  });
  it('provider-verified, inside window → verified', () => {
    expect(deriveKycState(verifiedProfile, NOW)).toMatchObject({ canadaVerified: true, indiaVerified: true, fullyVerified: true });
  });
  it('expired window → unverified', () => {
    const s = deriveKycState({ ...verifiedProfile, kycExpiresAt: past }, NOW);
    expect(s).toMatchObject({ canadaVerified: false, indiaVerified: false, fullyVerified: false, expired: true });
  });
  it('flags without kycVerifiedAt/kycExpiresAt (not from a provider) → unverified', () => {
    expect(deriveKycState({ kycStatus: 'verified', canadaVerified: true, indiaVerified: true }, NOW).fullyVerified).toBe(false);
  });
  it('truthy non-boolean values are not accepted', () => {
    const s = deriveKycState({ ...verifiedProfile, canadaVerified: 'true' as unknown as boolean, indiaVerified: 1 as unknown as boolean }, NOW);
    expect(s.canadaVerified).toBe(false); expect(s.indiaVerified).toBe(false); expect(s.fullyVerified).toBe(false);
  });
  it('both sides verified but kycStatus != verified → not fully verified', () => {
    expect(deriveKycState({ ...verifiedProfile, kycStatus: 'in_progress' }, NOW).fullyVerified).toBe(false);
  });
  it('unparseable dates → unverified', () => {
    expect(deriveKycState({ ...verifiedProfile, kycExpiresAt: 'not-a-date' }, NOW).fullyVerified).toBe(false);
  });
});

// ── unit: getVerifiedKycState ────────────────────────────────────────────────
describe('getVerifiedKycState', () => {
  it('reads only profiles, never kyc_submissions', async () => {
    state.tables.profiles = { data: verifiedProfile, error: null };
    state.tables.kyc_submissions = { data: forgedKycRow, error: null };
    const s = await getVerifiedKycState(USER);
    expect(s.fullyVerified).toBe(true);
    expect(state.calls.map(c => c.table)).toEqual(['profiles']);
  });
  it('DB error → throws (fail closed)', async () => {
    state.tables.profiles = { data: null, error: { message: 'connection refused' } };
    await expect(getVerifiedKycState(USER)).rejects.toBeInstanceOf(KycStateUnavailableError);
  });
  it('OrUnverified: DB error → unverified', async () => {
    state.tables.profiles = { data: null, error: { message: 'connection refused' } };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await getVerifiedKycStateOrUnverified(USER, 'test')).fullyVerified).toBe(false);
  });
  it('empty userId → throws', async () => {
    await expect(getVerifiedKycState('')).rejects.toBeInstanceOf(KycStateUnavailableError);
  });
});

// ── route: GET /auth/me (was auth.ts:603-604) ────────────────────────────────
describe('GET /auth/me', () => {
  const me = () => fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
  it('forged kyc_submissions flags are ignored when the profile is unverified', async () => {
    state.tables.profiles = { data: { id: USER, email: 'qa+028@example.test', kycStatus: 'pending', canadaVerified: false, indiaVerified: false }, error: null };
    state.tables.kyc_submissions = { data: forgedKycRow, error: null };
    const body = await me();
    expect(body.user.canadaBankVerified).toBe(false);
    expect(body.user.indiaNROVerified).toBe(false);
    expect(state.calls.some(c => c.table === 'kyc_submissions')).toBe(false);
  });
  it('provider-verified profile → verified', async () => {
    state.tables.profiles = { data: { id: USER, email: 'qa+028@example.test', ...verifiedProfile }, error: null };
    const body = await me();
    expect(body.user.canadaBankVerified).toBe(true);
    expect(body.user.indiaNROVerified).toBe(true);
  });
});

// ── route: POST /auth/login (was auth.ts:405-406) ────────────────────────────
describe('POST /auth/login', () => {
  it('returns verification from the authoritative profile state, not kyc_submissions', async () => {
    const hash = await bcrypt.hash('Synthetic-Pass-1', 4);
    state.tables.profiles = (c: Call) => {
      const sel = c.ops.find(o => o[0] === 'select')?.[1]?.[0] as string | undefined;
      if (sel && sel.includes('kycStatus')) return { data: { kycStatus: 'pending', canadaVerified: false, indiaVerified: false }, error: null };
      return { data: { id: USER, email: 'qa+028@example.test', password_hash: hash, failed_login_attempts: 0 }, error: null };
    };
    state.tables.kyc_submissions = { data: forgedKycRow, error: null };
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'qa+028@example.test', password: 'Synthetic-Pass-1' }),
    });
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.user.canadaBankVerified).toBe(false);
    expect(body.user.indiaNROVerified).toBe(false);
    expect(state.calls.some(c => c.table === 'kyc_submissions')).toBe(false);
  });
});

// ── route: POST /users/kyc/canada|india (self-attestation) ──────────────────
describe('POST /users/kyc/*', () => {
  const post = (path: string, body: object) => fetch(`${base}/users${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  const kycWrites = () => state.calls.filter(c => c.table === 'kyc_submissions').flatMap(c => c.ops.filter(o => ['upsert', 'insert', 'update'].includes(o[0])));
  it('/kyc/canada never sets canada_verified', async () => {
    const r = await post('/kyc/canada', { institution: 'QA Bank', holderName: 'QA Synthetic' });
    expect(r.status).toBe(200);
    expect((await r.json()).verified).toBe(false);
    const writes = kycWrites();
    expect(writes.length).toBe(1);
    expect(JSON.stringify(writes)).not.toMatch(/_verified/);
  });
  it('/kyc/india never sets india_verified', async () => {
    const r = await post('/kyc/india', { bankName: 'QA NRO Bank', branch: 'QA Branch' });
    expect(r.status).toBe(200);
    expect(JSON.stringify(kycWrites())).not.toMatch(/_verified/);
  });
});

// ── route: unsigned POST /webhooks/fable/kyc ─────────────────────────────────
describe('POST /webhooks/fable/kyc (unsigned)', () => {
  it('a "verified" payload does not write any verification state', async () => {
    await fetch(`${base}/webhooks/fable/kyc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER, status: 'verified' }),
    });
    await new Promise(r => setTimeout(r, 50)); // handler runs after the 200
    const writes = state.calls.filter(c => ['kyc_submissions', 'profiles'].includes(c.table));
    expect(writes).toEqual([]);
  });
});
