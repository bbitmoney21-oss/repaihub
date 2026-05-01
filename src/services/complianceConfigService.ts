// Reads IT Act 2025 compliance configuration from the compliance_config Supabase table.
// Migration 018 seeds the initial values.

import { supabaseAdmin } from '../lib/supabaseServer';

interface ComplianceConfig {
  form145ThresholdINR: number;          // ₹5,00,000 — Part C above this
  form146RequiredAboveINR: number;      // ₹5,00,000 — CA certificate required above this
  femaYearlyLimitINR: number;           // ₹8,30,00,000 — USD 1M cap
  swiftProcessingDays: number;          // 2 business days
  caApprovalTimeoutHours: number;       // 48 hours before reminder
  fintracThresholdCAD: number;          // CAD 10,000 — FINTRAC reporting threshold
  nreExemptionEnabled: boolean;         // NRE transfers exempt from Form 145/146
  partAAutoFile: boolean;               // Part A (< ₹5L) auto-files without CA review
  taxActVersion: string;                // '2025' | '1961'
}

let configCache: ComplianceConfig | null = null;
let cachedAt = 0;
const CACHE_TTL = 10 * 60 * 1000;

const DEFAULTS: ComplianceConfig = {
  form145ThresholdINR:       500_000,
  form146RequiredAboveINR:   500_000,
  femaYearlyLimitINR:     83_000_000,
  swiftProcessingDays:             2,
  caApprovalTimeoutHours:         48,
  fintracThresholdCAD:        10_000,
  nreExemptionEnabled:          true,
  partAAutoFile:                true,
  taxActVersion:              '2025',
};

export async function getComplianceConfig(): Promise<ComplianceConfig> {
  if (configCache && Date.now() - cachedAt < CACHE_TTL) return configCache;

  try {
    const { data } = await supabaseAdmin
      .from('compliance_config')
      .select('key, value');

    const raw: Record<string, string> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => { raw[r.key] = r.value; });

    configCache = {
      form145ThresholdINR:     Number(raw['form145_threshold_inr'])     || DEFAULTS.form145ThresholdINR,
      form146RequiredAboveINR: Number(raw['form146_required_above'])     || DEFAULTS.form146RequiredAboveINR,
      femaYearlyLimitINR:      Number(raw['fema_yearly_limit_inr'])      || DEFAULTS.femaYearlyLimitINR,
      swiftProcessingDays:     Number(raw['swift_processing_days'])      || DEFAULTS.swiftProcessingDays,
      caApprovalTimeoutHours:  Number(raw['ca_approval_timeout_hours'])  || DEFAULTS.caApprovalTimeoutHours,
      fintracThresholdCAD:     Number(raw['fintrac_threshold_cad'])      || DEFAULTS.fintracThresholdCAD,
      nreExemptionEnabled:     raw['nre_exemption_enabled'] !== 'false',
      partAAutoFile:           raw['part_a_auto_file']      !== 'false',
      taxActVersion:           raw['tax_act_version']       || DEFAULTS.taxActVersion,
    };
  } catch {
    configCache = { ...DEFAULTS };
  }

  cachedAt = Date.now();
  return configCache;
}

export function clearComplianceConfigCache(): void {
  configCache = null;
  cachedAt = 0;
}
