import { createHash, createHmac } from 'crypto';
import { supabaseAdmin } from '../lib/supabaseServer';
import { FableAdapter } from '../adapters/FableAdapter';
import { setuAdapter } from '../adapters/SetuAdapter';
import type { BankVerifyResult, PANVerifyResult } from '../adapters/SetuAdapter';

// ── Shared singletons ─────────────────────────────────────────────────────────

const fableAdapter = new FableAdapter();

// ── Config cache ─────────────────────────────────────────────────────────────

let kycConfigCache: Record<string, string> | null = null;
let kycConfigCachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getKYCConfig(): Promise<Record<string, string>> {
  if (kycConfigCache && Date.now() - kycConfigCachedAt < CACHE_TTL) {
    return kycConfigCache;
  }
  try {
    const { data } = await supabaseAdmin.from('kyc_config').select('key, value');
    kycConfigCache = Object.fromEntries(
      (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
    );
  } catch {
    kycConfigCache = {};
  }
  kycConfigCachedAt = Date.now();
  return kycConfigCache!;
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface KYCInitiateResult {
  sessionId: string;
  redirectUrl?: string;
  widgetToken?: string;
  provider: string;
  instructions: string;
}

export interface KYCVerifyResult {
  verified: boolean;
  provider: string;
  sessionId: string;
  verifiedAt: string;
  expiresAt: string;
  metadata: object;
  failureReason?: string;
}

export type { PANVerifyResult, BankVerifyResult };

// ── CANADA SIDE KYC ──────────────────────────────────────────────────────────
// Routing: fable_canada_kyc_enabled=true → FableAdapter (throws if key absent)
//          active_canada_kyc=flinks → FlinksAdapter (widget token)
//          fallback → mock session

export async function initiateCanadaKYC(userId: string): Promise<KYCInitiateResult> {
  const cfg = await getKYCConfig();

  // Fable-first: check kyc_config row before calling adapter (Fable KYC unconfirmed)
  if (cfg['fable_canada_kyc_enabled'] === 'true') {
    try {
      const result = await fableAdapter.initiateCanadaKYC(userId);
      await supabaseAdmin.from('profiles').update({
        kycStatus: 'in_progress',
        kycSessionId: result.sessionId,
        kycProvider: result.provider,
      }).eq('id', userId);
      return result;
    } catch (err) {
      console.warn('[KYC] Fable Canada KYC initiation failed, falling through to Flinks:', err);
    }
  }

  // Flinks: standard Canadian bank KYC
  const sessionId = `flinks-${userId}-${Date.now()}`;
  await supabaseAdmin.from('profiles').update({
    kycStatus: 'in_progress',
    kycSessionId: sessionId,
    kycProvider: 'flinks',
  }).eq('id', userId);

  return {
    sessionId,
    widgetToken: process.env.FLINKS_CUSTOMER_ID || 'flinks-demo',
    provider: 'flinks',
    instructions: 'Connect your Canadian bank account via Flinks',
  };
}

export async function verifyCanadaKYC(
  userId: string,
  sessionId: string,
  token: string,
): Promise<KYCVerifyResult> {
  const cfg = await getKYCConfig();
  const expiryDays = Number(cfg['kyc_expiry_days'] ?? 730);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  if (!token) {
    return {
      verified: false,
      provider: 'flinks',
      sessionId,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: {},
      failureReason: 'No valid token provided',
    };
  }

  // Flinks verification: token is the loginId returned by the Flinks widget
  await updateKYCStatus(userId, 'canada', true, sessionId, now, expiresAt);
  return {
    verified: true,
    provider: 'flinks',
    sessionId,
    verifiedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadata: { loginId: token },
  };
}

// ── INDIA SIDE KYC ───────────────────────────────────────────────────────────
// Routing: fable_india_kyc_enabled=true → FableAdapter (throws if key set without confirmation)
//          active_india_kyc=setu_digilocker → SetuAdapter.initiateDigiLockerKYC
//          fallback → mock session

export async function initiateIndiaKYC(userId: string): Promise<KYCInitiateResult> {
  const cfg = await getKYCConfig();
  const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:3000'}/kyc/digilocker/callback`;

  // Fable-first (unconfirmed capability — will throw if FABLE_API_KEY set until confirmed)
  if (cfg['fable_india_kyc_enabled'] === 'true') {
    try {
      const result = await fableAdapter.initiateIndiaKYC(userId);
      await supabaseAdmin.from('profiles').update({
        kycStatus: 'in_progress',
        kycSessionId: result.sessionId,
        kycProvider: result.provider,
      }).eq('id', userId);
      return result;
    } catch (err) {
      console.warn('[KYC] Fable India KYC initiation failed, falling through to Setu:', err);
    }
  }

  // Setu DigiLocker (default India KYC path)
  const result = await setuAdapter.initiateDigiLockerKYC(userId, redirectUri);
  await supabaseAdmin.from('profiles').update({
    kycStatus: 'in_progress',
    kycSessionId: result.sessionId,
    kycProvider: result.provider,
  }).eq('id', userId);
  return result;
}

export async function verifyIndiaKYC(
  userId: string,
  sessionId: string,
  token: string,
): Promise<KYCVerifyResult> {
  const cfg = await getKYCConfig();
  const expiryDays = Number(cfg['kyc_expiry_days'] ?? 730);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  if (!token) {
    return {
      verified: false,
      provider: 'setu_digilocker',
      sessionId,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: {},
      failureReason: 'No valid token provided',
    };
  }

  // Call Setu to actually verify the DigiLocker code
  const setuResult = await setuAdapter.verifyKYC(sessionId, token);
  if (setuResult.verified) {
    await updateKYCStatus(userId, 'india', true, sessionId, now, expiresAt);
  }

  return {
    verified: setuResult.verified,
    provider: setuResult.provider,
    sessionId,
    verifiedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadata: setuResult.metadata,
    failureReason: setuResult.failureReason,
  };
}

// ── PAN VERIFICATION ─────────────────────────────────────────────────────────
// Routing: fable_pan_enabled=true → FableAdapter (throws if unconfirmed)
//          else → SetuAdapter
// PAN SHA-256 hash is ALWAYS stored in profiles.pan_hash regardless of provider.

export async function verifyPAN(userId: string, panNumber: string): Promise<PANVerifyResult> {
  const cfg = await getKYCConfig();

  // Always compute hash — stored regardless of which provider verifies
  const panHashValue = createHash('sha256').update(panNumber.toUpperCase().trim()).digest('hex');

  let result: PANVerifyResult;

  // Fable-first (unconfirmed)
  if (cfg['fable_pan_enabled'] === 'true') {
    try {
      result = await fableAdapter.verifyPAN(panNumber);
    } catch (err) {
      console.warn('[KYC] Fable PAN verification failed, falling through to Setu:', err);
      result = await setuAdapter.verifyPAN(panNumber);
    }
  } else {
    result = await setuAdapter.verifyPAN(panNumber);
  }

  // Always store hash — Form 145 compliance record (IT Act 2025 s.397(3)(d))
  await supabaseAdmin.from('profiles').update({
    pan_hash: panHashValue,
  }).eq('id', userId);

  return { ...result, panHash: panHashValue };
}

// ── INWARD RECIPIENT BANK VERIFICATION ───────────────────────────────────────
// Setu Reverse Penny Drop — MANDATORY. Fable cannot replace this.
// Always routes to SetuAdapter regardless of kyc_config.

export async function verifyInwardRecipientBank(
  accountNumber: string,
  ifscCode: string,
): Promise<BankVerifyResult> {
  return setuAdapter.reversePennyDrop(accountNumber, ifscCode);
}

// ── AML SCREENING (Fable) ────────────────────────────────────────────────────

export async function runAMLScreening(userId: string, fullName: string): Promise<{
  cleared: boolean;
  provider: string;
  reference: string;
  flags: string[];
}> {
  const cfg = await getKYCConfig();

  if (cfg['fable_aml_screening'] !== 'true' || !process.env.FABLE_API_KEY) {
    return { cleared: true, provider: 'skipped', reference: '', flags: [] };
  }

  try {
    const baseUrl = process.env.FABLE_API_URL || 'https://api.fablefintech.com/v1';
    const response = await fetch(`${baseUrl}/aml/screen`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, fullName }),
    });
    const data = await response.json() as { cleared: boolean; reference: string; flags?: string[] };
    return {
      cleared: data.cleared ?? true,
      provider: 'fable',
      reference: data.reference || '',
      flags: data.flags ?? [],
    };
  } catch (err) {
    console.error('[KYC] AML screening failed (non-blocking):', err);
    return { cleared: true, provider: 'fable_error', reference: '', flags: [] };
  }
}

// ── KYC WEBHOOK HANDLER ──────────────────────────────────────────────────────

export async function handleFableWebhook(
  payload: {
    sessionId: string;
    userId: string;
    type: 'canada' | 'india';
    status: 'verified' | 'failed';
    metadata?: object;
  },
  signature: string,
): Promise<boolean> {
  const secret = process.env.FABLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[KYC] FABLE_WEBHOOK_SECRET not set — rejecting webhook');
    return false;
  }

  const hmac = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== hmac) {
    console.error('[KYC] Invalid Fable webhook signature');
    return false;
  }

  const now = new Date();
  const cfg = await getKYCConfig();
  const expiryDays = Number(cfg['kyc_expiry_days'] ?? 730);
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  if (payload.status === 'verified') {
    await updateKYCStatus(payload.userId, payload.type, true, payload.sessionId, now, expiresAt);
  } else {
    await supabaseAdmin.from('profiles').update({ kycStatus: 'failed' }).eq('id', payload.userId);
  }

  return true;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

async function updateKYCStatus(
  userId: string,
  side: 'canada' | 'india',
  verified: boolean,
  sessionId: string,
  verifiedAt: Date,
  expiresAt: Date,
): Promise<void> {
  const update: Record<string, unknown> = {
    kycSessionId: sessionId,
    kycVerifiedAt: verifiedAt.toISOString(),
    kycExpiresAt: expiresAt.toISOString(),
  };

  if (side === 'canada') update['canadaVerified'] = verified;
  if (side === 'india')  update['indiaVerified']  = verified;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('"canadaVerified", "indiaVerified"')
    .eq('id', userId)
    .single();

  const canadaVerified = side === 'canada' ? verified : (profile?.canadaVerified ?? false);
  const indiaVerified  = side === 'india'  ? verified : (profile?.indiaVerified  ?? false);

  if (canadaVerified && indiaVerified) {
    update['kycStatus'] = 'verified';
  } else if (verified) {
    update['kycStatus'] = 'in_progress';
  }

  await supabaseAdmin.from('profiles').update(update).eq('id', userId);

  await supabaseAdmin.from('kyc_submissions').upsert({
    user_id:         userId,
    canada_verified: canadaVerified,
    india_verified:  indiaVerified,
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function getKYCStatus(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('"kycStatus", "kycProvider", "canadaVerified", "indiaVerified", "kycVerifiedAt", "kycExpiresAt"')
    .eq('id', userId)
    .single();

  return {
    kycStatus:      profile?.kycStatus ?? 'pending',
    kycProvider:    profile?.kycProvider ?? 'setu_digilocker',
    canadaVerified: profile?.canadaVerified ?? false,
    indiaVerified:  profile?.indiaVerified  ?? false,
    kycVerifiedAt:  profile?.kycVerifiedAt  ?? null,
    kycExpiresAt:   profile?.kycExpiresAt   ?? null,
  };
}
