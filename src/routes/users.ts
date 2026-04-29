import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';

const router = Router();
const ts = () => new Date().toISOString();

// ── GET /users/profile ────────────────────────────────────────────────────────
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
  const [profileRes, kycRes, canadaRes, indiaRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
    supabaseAdmin.from('kyc_submissions').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('canada_bank_accounts').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('india_nro_accounts').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  res.json({
    profile: profileRes.data,
    kyc: kycRes.data,
    canadaBank: canadaRes.data,
    indiaAccount: indiaRes.data,
    timestamp: ts(),
  });
});

// ── PUT /users/profile ────────────────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ message: 'Profile updated (demo mode)', timestamp: ts() });
    return;
  }

  const allowed = ['full_name', 'phone', 'residency'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
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
    res.status(500).json({ error: error.message, timestamp: ts() });
    return;
  }

  res.json({ message: 'Profile updated', timestamp: ts() });
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
