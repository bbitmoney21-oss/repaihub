// KYC routing smoke tests — run with: tsx src/__tests__/kyc_routing_test.ts
// Requires no DB connection, no API keys. All mock paths.

import { SetuAdapter } from '../adapters/SetuAdapter.ts';
import { FableAdapter } from '../adapters/FableAdapter.ts';
import { MockFableAdapter } from '../adapters/MockFableAdapter.ts';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ── Test 1: SetuAdapter mock mode — no SETU_API_KEY ──────────────────────────
console.log('\nTest 1: SetuAdapter mock mode (no SETU_API_KEY)');
const setu = new SetuAdapter();

const bank = await setu.reversePennyDrop('1234567890', 'HDFC0001234');
assert('reversePennyDrop returns verified=true in mock mode', bank.verified === true);
assert('reversePennyDrop provider contains mock', bank.provider.includes('mock'));

const pan = await setu.verifyPAN('ABCDE1234F');
assert('verifyPAN returns valid=true in mock mode', pan.valid === true);
assert('verifyPAN always sets panHash', typeof pan.panHash === 'string' && pan.panHash.length === 64);

const kyc = await setu.initiateDigiLockerKYC('user-test-123', 'http://localhost:3000/cb');
assert('initiateDigiLockerKYC returns sessionId', !!kyc.sessionId);
assert('initiateDigiLockerKYC provider contains mock', kyc.provider.includes('mock'));

// ── Test 2: Setu verifyKYC mock mode ─────────────────────────────────────────
console.log('\nTest 2: Setu verifyKYC mock mode');
const verify = await setu.verifyKYC('session-abc', 'DIGILOCKER_CODE_123');
assert('verifyKYC returns verified=true in mock mode', verify.verified === true);
assert('verifyKYC returns future expiresAt', new Date(verify.expiresAt) > new Date());

// ── Test 3: FableAdapter KYC stubs throw when key is absent (returns mock) ──
console.log('\nTest 3: FableAdapter KYC stubs return mock when no FABLE_API_KEY');
const fable = new FableAdapter();
// Without FABLE_API_KEY set, all KYC calls should delegate to MockFableAdapter (not throw)
delete process.env['FABLE_API_KEY'];

const fableIndia = await fable.initiateIndiaKYC('user-test-456');
assert('FableAdapter.initiateIndiaKYC returns mock when no key', fableIndia.provider.includes('mock'));

const fableCanada = await fable.initiateCanadaKYC('user-test-456');
assert('FableAdapter.initiateCanadaKYC returns mock when no key', fableCanada.provider.includes('mock'));

const fablePAN = await fable.verifyPAN('ABCDE1234F');
assert('FableAdapter.verifyPAN returns mock when no key', fablePAN.provider.includes('mock'));
assert('FableAdapter.verifyPAN panHash is 64-char hex', typeof fablePAN.panHash === 'string' && fablePAN.panHash.length === 64);

// ── Test 4: PAN hash is deterministic ─────────────────────────────────────────
console.log('\nTest 4: PAN SHA-256 hash is deterministic');
import { createHash } from 'crypto';
const testPAN = 'ABCDE1234F';
const expectedHash = createHash('sha256').update(testPAN.toUpperCase().trim()).digest('hex');
const setuPanResult = await setu.verifyPAN(testPAN);
assert('Setu panHash matches manual SHA-256', setuPanResult.panHash === expectedHash);
const mockPanResult = await new MockFableAdapter().verifyPAN(testPAN);
assert('MockFable panHash matches manual SHA-256', mockPanResult.panHash === expectedHash);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════`);
console.log(`KYC routing tests: ${passed} PASS / ${failed} FAIL`);
console.log(`═══════════════════════════════════`);

if (failed > 0) process.exit(1);
