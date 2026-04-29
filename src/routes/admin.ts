import { Router, Response } from 'express';
import { caAuthMiddleware, CARequest } from '../middleware/caAuth';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { clearFeeConfigCache } from '../services/feeService';
import { clearRiskCache } from '../services/riskService';
import { clearComplianceCache } from '../services/complianceService';

const router = Router();
const ts = () => new Date().toISOString();

function notConfigured(res: Response): void {
  res.status(503).json({ error: 'Supabase not configured', timestamp: ts() });
}

// ── Fee config ────────────────────────────────────────────────────────────────

// GET /admin/fees — list all fee_config rows
router.get('/fees', caAuthMiddleware, async (_req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const { data, error } = await supabaseAdmin
    .from('fee_config')
    .select('*')
    .order('key');

  if (error) { res.status(500).json({ error: error.message, timestamp: ts() }); return; }
  res.json({ fees: data, count: data?.length ?? 0, timestamp: ts() });
});

// PUT /admin/fees/:key — update a fee value (clears 5-min cache immediately)
router.put('/fees/:key', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const { key } = req.params;
  const { value, updated_by } = req.body as { value?: unknown; updated_by?: string };

  if (value === undefined || isNaN(Number(value))) {
    res.status(400).json({ error: 'value (number) is required', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('fee_config')
    .update({ value: Number(value), updated_by: updated_by ?? req.caUser?.email ?? 'admin', updated_at: ts() })
    .eq('key', String(key))
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: error?.message ?? 'Fee key not found', timestamp: ts() });
    return;
  }

  clearFeeConfigCache();
  res.json({ message: `Fee "${key}" updated to ${value}. Cache cleared.`, fee: data, timestamp: ts() });
});

// ── Risk rules ────────────────────────────────────────────────────────────────

// GET /admin/risk-rules — list all risk scoring weights
router.get('/risk-rules', caAuthMiddleware, async (_req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const { data, error } = await supabaseAdmin
    .from('risk_rules')
    .select('*')
    .order('factor');

  if (error) { res.status(500).json({ error: error.message, timestamp: ts() }); return; }
  res.json({ rules: data, count: data?.length ?? 0, timestamp: ts() });
});

// PUT /admin/risk-rules/:factor — update a risk weight (clears cache)
router.put('/risk-rules/:factor', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const { factor } = req.params;
  const { weight } = req.body as { weight?: unknown };

  if (weight === undefined || isNaN(Number(weight))) {
    res.status(400).json({ error: 'weight (integer) is required', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('risk_rules')
    .update({ weight: Math.round(Number(weight)), updated_at: ts() })
    .eq('factor', String(factor))
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: error?.message ?? 'Factor not found', timestamp: ts() });
    return;
  }

  clearRiskCache();
  res.json({ message: `Risk weight for "${factor}" updated to ${weight}. Cache cleared.`, rule: data, timestamp: ts() });
});

// ── Promo codes ───────────────────────────────────────────────────────────────

// GET /admin/promos — list all promo codes with usage stats
router.get('/promos', caAuthMiddleware, async (_req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message, timestamp: ts() }); return; }
  res.json({ promos: data, count: data?.length ?? 0, timestamp: ts() });
});

// POST /admin/promos — create a new promo code
router.post('/promos', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const {
    code, description, discount_type, discount_value,
    applies_to, min_amount_inr, max_uses_total, max_uses_per_user, valid_until,
  } = req.body;

  if (!code || !description || !discount_type) {
    res.status(400).json({ error: 'code, description, discount_type are required', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .insert({
      code:              String(code).toUpperCase(),
      description,
      discount_type,
      discount_value:    discount_value    ?? 0,
      applies_to:        applies_to        ?? 'once_per_user',
      min_amount_inr:    min_amount_inr    ?? 0,
      max_uses_total:    max_uses_total    ?? null,
      max_uses_per_user: max_uses_per_user ?? 1,
      valid_until:       valid_until       ?? null,
    })
    .select()
    .single();

  if (error) { res.status(400).json({ error: error.message, timestamp: ts() }); return; }
  res.status(201).json({ promo: data, timestamp: ts() });
});

// PUT /admin/promos/:id — update a promo (activate/deactivate/extend/change value)
router.put('/promos/:id', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const allowed = [
    'description', 'discount_value', 'is_active', 'valid_until',
    'max_uses_total', 'max_uses_per_user', 'applies_to', 'min_amount_inr',
  ];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in req.body) updates[k] = req.body[k];
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update', timestamp: ts() });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: error?.message ?? 'Promo not found', timestamp: ts() });
    return;
  }
  res.json({ promo: data, timestamp: ts() });
});

// ── Referrals ─────────────────────────────────────────────────────────────────

// GET /admin/referrals — list all referral relationships and reward status
router.get('/referrals', caAuthMiddleware, async (_req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const { data, error } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) { res.status(500).json({ error: error.message, timestamp: ts() }); return; }
  res.json({ referrals: data, count: data?.length ?? 0, timestamp: ts() });
});

// ── Audit logs ────────────────────────────────────────────────────────────────

// GET /admin/audit-logs — recent audit log entries
router.get('/audit-logs', caAuthMiddleware, async (req: CARequest, res: Response) => {
  if (!supabaseAdminConfigured) return notConfigured(res);

  const limit  = Math.min(Number(req.query.limit)  || 50,  500);
  const entity = req.query.entity_type as string | undefined;

  let query = supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (entity) query = query.eq('entity_type', entity);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message, timestamp: ts() }); return; }
  res.json({ logs: data, count: data?.length ?? 0, timestamp: ts() });
});

// ── Cache management ──────────────────────────────────────────────────────────

// POST /admin/clear-cache — force-expire all in-memory caches
router.post('/clear-cache', caAuthMiddleware, (_req: CARequest, res: Response) => {
  clearFeeConfigCache();
  clearRiskCache();
  clearComplianceCache();
  res.json({ message: 'All caches cleared (fee_config, risk_rules, compliance_rules)', timestamp: ts() });
});

export default router;
