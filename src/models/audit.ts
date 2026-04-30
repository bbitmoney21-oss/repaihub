// [GREY] Audit model — TypeScript interfaces matching audit_logs table

export interface AuditLog {
  id: string;
  action: string;
  actor: 'system' | 'customer' | 'ca_partner' | 'admin';
  transfer_id: string | null;
  transfer_type: 'outward' | 'inward' | null;
  user_id: string | null;
  metadata: object;
  ip_hash: string | null;
  created_at: string;
}
