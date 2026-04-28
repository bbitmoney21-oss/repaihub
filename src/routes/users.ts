import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';

const router = Router();

// ── GET /users/profile ────────────────────────────────────────────────────────
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({
      profile: {
        id: req.userId,
        email: req.userEmail,
        full_name: 'Demo User',
        phone: null,
        residency: null,
      },
      kyc: null,
      canadaBank: null,
      indiaAccount: null,
      timestamp: new Date().toISOString(),
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
    timestamp: new Date().toISOString(),
  });
});

export default router;
