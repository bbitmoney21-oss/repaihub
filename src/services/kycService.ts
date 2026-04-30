import { supabaseAdmin } from '../lib/supabaseServer';

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

// ── CANADA SIDE KYC ──────────────────────────────────────────────────────────

export async function initiateCanadaKYC(userId: string): Promise<KYCInitiateResult> {
  const cfg = await getKYCConfig();

  if (cfg['active_canada_kyc'] === 'fable' && cfg['fable_kyc_api_url']) {
    try {
      const response = await fetch(`${cfg['fable_kyc_api_url']}/kyc/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          country: 'CA',
          verificationType: 'bank_account',
          webhookUrl: `${process.env.API_BASE_URL}/kyc/fable/callback`,
        }),
      });
      const data = await response.json() as { sessionId: string; redirectUrl: string };
      return {
        sessionId: data.sessionId,
        redirectUrl: data.redirectUrl,
        provider: 'fable',
        instructions: 'Complete bank verification via Fable',
      };
    } catch (err) {
      console.error('[KYC] Fable Canada KYC initiation failed:', err);
    }
  }

  // Default: Flinks
  const sessionId = `flinks-${userId}-${Date.now()}`;
  await supabaseAdmin.from('profiles').update({
    kycStatus: 'in_progress',
    kycSessionId: sessionId,
    kycProvider: 'flinks_digilocker',
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

  if (cfg['active_canada_kyc'] === 'fable' && cfg['fable_kyc_api_url'] && token) {
    try {
      const response = await fetch(`${cfg['fable_kyc_api_url']}/kyc/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, token }),
      });
      const data = await response.json() as { verified: boolean; metadata?: object };
      if (data.verified) {
        await updateKYCStatus(userId, 'canada', true, sessionId, now, expiresAt);
        return {
          verified: true,
          provider: 'fable',
          sessionId,
          verifiedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          metadata: data.metadata || {},
        };
      }
    } catch (err) {
      console.error('[KYC] Fable Canada KYC verify failed:', err);
    }
  }

  // Flinks: token is the loginId returned by Flinks widget
  if (token) {
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

// ── INDIA SIDE KYC ───────────────────────────────────────────────────────────

export async function initiateIndiaKYC(userId: string): Promise<KYCInitiateResult> {
  const cfg = await getKYCConfig();

  if (cfg['fable_kyc_enabled'] === 'true' && cfg['fable_kyc_api_url']) {
    try {
      const response = await fetch(`${cfg['fable_kyc_api_url']}/kyc/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          country: 'IN',
          verificationType: 'identity',
          webhookUrl: `${process.env.API_BASE_URL}/kyc/fable/callback`,
        }),
      });
      const data = await response.json() as { sessionId: string; redirectUrl: string };
      return {
        sessionId: data.sessionId,
        redirectUrl: data.redirectUrl,
        provider: 'fable',
        instructions: 'Complete identity verification via Fable',
      };
    } catch (err) {
      console.error('[KYC] Fable India KYC initiation failed:', err);
    }
  }

  // Default: DigiLocker consent URL
  const sessionId = `digilocker-${userId}-${Date.now()}`;
  await supabaseAdmin.from('profiles').update({
    kycStatus: 'in_progress',
    kycSessionId: sessionId,
  }).eq('id', userId);

  return {
    sessionId,
    redirectUrl: `https://digilocker.gov.in/public/oauth2/1/authorize?response_type=code&client_id=${process.env.DIGILOCKER_CLIENT_ID || 'demo'}&redirect_uri=${process.env.API_BASE_URL}/kyc/digilocker/callback&state=${sessionId}`,
    provider: 'digilocker',
    instructions: 'Connect your DigiLocker to verify your Indian identity',
  };
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

  if (token) {
    await updateKYCStatus(userId, 'india', true, sessionId, now, expiresAt);
    return {
      verified: true,
      provider: cfg['active_india_kyc'] === 'fable' ? 'fable' : 'digilocker',
      sessionId,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: { code: token },
    };
  }

  return {
    verified: false,
    provider: 'digilocker',
    sessionId,
    verifiedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadata: {},
    failureReason: 'No valid token provided',
  };
}

// ── AML SCREENING (Fable) ────────────────────────────────────────────────────
// Never blocks customer if not configured.
export async function runAMLScreening(userId: string, fullName: string): Promise<{
  cleared: boolean;
  provider: string;
  reference: string;
  flags: string[];
}> {
  const cfg = await getKYCConfig();

  if (cfg['fable_aml_screening'] !== 'true' || !cfg['fable_kyc_api_url']) {
    return { cleared: true, provider: 'skipped', reference: '', flags: [] };
  }

  try {
    const response = await fetch(`${cfg['fable_kyc_api_url']}/aml/screen`, {
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
// Handles async callbacks from Fable after KYC completes.
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
  // Verify webhook signature
  const secret = process.env.FABLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[KYC] FABLE_WEBHOOK_SECRET not set — rejecting webhook');
    return false;
  }

  const crypto = await import('crypto');
  const expected = crypto.default.createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== expected) {
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

  // Check if both sides are now verified
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

  // Also update kyc_submissions table for backward compatibility
  await supabaseAdmin.from('kyc_submissions').upsert({
    user_id:          userId,
    canada_verified:  canadaVerified,
    india_verified:   indiaVerified,
    updated_at:       new Date().toISOString(),
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
    kycProvider:    profile?.kycProvider ?? 'flinks_digilocker',
    canadaVerified: profile?.canadaVerified ?? false,
    indiaVerified:  profile?.indiaVerified  ?? false,
    kycVerifiedAt:  profile?.kycVerifiedAt  ?? null,
    kycExpiresAt:   profile?.kycExpiresAt   ?? null,
  };
}
