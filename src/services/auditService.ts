import { supabaseAdmin } from '../lib/supabaseServer';

export async function log(
  action: string,
  actor: 'system' | 'customer' | 'ca_partner' | 'admin',
  opts: {
    transferId?: string;
    transferType?: 'outward' | 'inward';
    userId?: string;
    metadata?: object;
    ipHash?: string;
  } = {},
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action,
      actor,
      transfer_id:   opts.transferId   || null,
      transfer_type: opts.transferType || 'outward',
      user_id:       opts.userId       || null,
      metadata:      opts.metadata     || {},
      ip_hash:       opts.ipHash       || null,
    });
  } catch (err) {
    // NEVER throw — audit failure must never block business logic
    console.error('[AUDIT] Failed to log:', action, err);
  }
}
