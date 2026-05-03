import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';

const router = Router();
const ts = () => new Date().toISOString();

// ── GET /users/profile ────────────────────────────────────────────────────────
//
// Fault-tolerant by design: one missing/unreachable side-table (KYC, banks)
// must not 500 the whole profile fetch. Uses Promise.allSettled so each
// sub-query reports independently. Returns 500 only if the *primary* profile
// row cannot be loaded (which is a real auth/user mismatch). In dev mode
// the response includes a `debug` array listing any sub-query failures so
// the browser Network tab tells the truth without spelunking server logs.
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({
      profile: { id: req.userId, email: req.userEmail, full_name: 'Demo User', phone: null, residency: null },
      kyc: null,
      canadaBank: null,
      indiaAccount: null,
      timestamp: ts(),
    });
    return;
  }

  const userId = req.userId!;
  const isDev = process.env.NODE_ENV !== 'production';

  try {
    const settled = await Promise.allSettled([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('kyc_submissions').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('canada_bank_accounts').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('india_nro_accounts').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const labels = ['profile', 'kyc', 'canadaBank', 'indiaAccount'] as const;
    const debug: Array<{ table: string; status: string; error?: string }> = [];

    type SettledRow = { data: Record<string, unknown> | null; error: { message: string } | null } | undefined;
    const rows: Record<typeof labels[number], Record<string, unknown> | null> = {
      profile: null, kyc: null, canadaBank: null, indiaAccount: null,
    };

    settled.forEach((r, i) => {
      const label = labels[i];
      if (r.status === 'rejected') {
        const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
        console.error(`[GET /users/profile] ${label} query threw:`, reason);
        debug.push({ table: label, status: 'rejected', error: reason });
        return;
      }
      const value = r.value as SettledRow;
      if (value?.error) {
        console.error(`[GET /users/profile] ${label} query error:`, value.error.message);
        debug.push({ table: label, status: 'error', error: value.error.message });
        return;
      }
      rows[label] = value?.data ?? null;
      debug.push({ table: label, status: 'ok' });
    });

    // Hard fail only if the primary profile row couldn't load AT ALL.
    const profileSettled = settled[0];
    const profileFailed =
      profileSettled.status === 'rejected' ||
      (profileSettled.status === 'fulfilled' &&
        (profileSettled.value as SettledRow)?.error != null);

    if (profileFailed) {
      const err =
        profileSettled.status === 'rejected'
          ? (profileSettled.reason instanceof Error ? profileSettled.reason.message : String(profileSettled.reason))
          : (profileSettled.value as SettledRow)?.error?.message ?? 'Unknown profile error';
      res.status(500).json({
        error: 'Failed to load profile',
        timestamp: ts(),
        ...(isDev ? { debug: { cause: err, perTable: debug } } : {}),
      });
      return;
    }

    res.json({
      profile: rows.profile,
      kyc: rows.kyc,
      canadaBank: rows.canadaBank,
      indiaAccount: rows.indiaAccount,
      timestamp: ts(),
      ...(isDev ? { debug } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load profile';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[GET /users/profile] Unhandled error:', msg);
    if (stack) console.error(stack);
    res.status(500).json({
      error: msg,
      timestamp: ts(),
      ...(isDev ? { debug: { stack } } : {}),
    });
  }
});

// ── PUT /users/profile ────────────────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ message: 'Profile updated (demo mode)', timestamp: ts() });
    return;
  }

  try {
    const allowed = ['full_name', 'phone', 'residency', 'residency_type'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = (req.body as Record<string, unknown>)[key];
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update', timestamp: ts() });
      return;
    }

    updates.updated_at = ts();

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.userId!);

    if (error) {
      console.error('[PUT /users/profile] Update error:', error.message);
      res.status(500).json({ error: error.message, timestamp: ts() });
      return;
    }

    res.json({ message: 'Profile updated', timestamp: ts() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile';
    console.error('[PUT /users/profile] Unhandled error:', msg);
    res.status(500).json({ error: msg, timestamp: ts() });
  }
});

// ── POST /users/kyc/canada ────────────────────────────────────────────────────
router.post('/kyc/canada', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { institution, holderName } = req.body as { institution?: string; holderName?: string };

  if (!institution || !holderName) {
    res.status(400).json({ error: 'institution and holderName are required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.json({ message: 'Canada KYC submitted (demo mode)', timestamp: ts() });
    return;
  }

  const userId = req.userId!;

  const { error: bankErr } = await supabaseAdmin.from('canada_bank_accounts').insert({
    user_id: userId,
    institution,
    holder_name: holderName,
    account_type: 'Chequing',
  });

  if (bankErr) {
    res.status(500).json({ error: bankErr.message, timestamp: ts() });
    return;
  }

  await supabaseAdmin.from('kyc_submissions').upsert(
    { user_id: userId, canada_verified: true, canada_verified_at: ts() },
    { onConflict: 'user_id' },
  );

  res.json({ message: 'Canada KYC submitted', timestamp: ts() });
});

// ── POST /users/kyc/india ─────────────────────────────────────────────────────
router.post('/kyc/india', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { bankName, branch } = req.body as { bankName?: string; branch?: string };

  if (!bankName || !branch) {
    res.status(400).json({ error: 'bankName and branch are required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.json({ message: 'India KYC submitted (demo mode)', timestamp: ts() });
    return;
  }

  const userId = req.userId!;

  const { error: bankErr } = await supabaseAdmin.from('india_nro_accounts').insert({
    user_id: userId,
    bank_name: bankName,
    branch,
  });

  if (bankErr) {
    res.status(500).json({ error: bankErr.message, timestamp: ts() });
    return;
  }

  await supabaseAdmin.from('kyc_submissions').upsert(
    { user_id: userId, india_verified: true, india_verified_at: ts() },
    { onConflict: 'user_id' },
  );

  // Mark signup as fully complete now that all four steps are done.
  // Migration 014 adds the column; if it hasn't been applied yet we just log
  // and continue — the rest of the flow doesn't depend on this flag.
  const { error: completeErr } = await supabaseAdmin
    .from('profiles')
    .update({ signup_complete: true })
    .eq('id', userId);
  if (completeErr) {
    console.warn('[Users] signup_complete update skipped (apply migration 014):', completeErr.message);
  }

  res.json({ message: 'India KYC submitted', timestamp: ts() });
});

// ── GET /users/referral ───────────────────────────────────────────────────────
router.get('/referral', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ referralCode: null, totalReferrals: 0, totalEarnedCAD: 0, referrals: [], timestamp: ts() });
    return;
  }

  const userId = req.userId!;
  const [codeRes, referralsRes] = await Promise.all([
    supabaseAdmin.from('referral_codes').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('referrals').select('*').eq('referrer_user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  res.json({
    referralCode:    codeRes.data?.code         ?? null,
    totalReferrals:  codeRes.data?.total_referrals  ?? 0,
    totalEarnedCAD:  codeRes.data?.total_earned_cad ?? 0,
    referrals:       referralsRes.data ?? [],
    timestamp:       ts(),
  });
});

// ── GET /users/credits ────────────────────────────────────────────────────────
router.get('/credits', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ balanceCAD: 0, totalEarned: 0, totalSpent: 0, timestamp: ts() });
    return;
  }

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('*')
    .eq('user_id', req.userId!)
    .maybeSingle();

  res.json({
    balanceCAD:  data?.balance_cad  ?? 0,
    totalEarned: data?.total_earned ?? 0,
    totalSpent:  data?.total_spent  ?? 0,
    updatedAt:   data?.updated_at   ?? null,
    timestamp:   ts(),
  });
});

export default router;
