// [GREEN] PaymentRailsService — reads Supabase to return the active adapter
// To switch from mock to Fable: UPDATE payment_rails_config SET value='fable'
// Zero code changes ever required to switch providers

import { supabaseAdmin } from '../lib/supabaseServer.js';
import type { IPaymentGateway } from '../adapters/IPaymentGateway.js';
import { FableAdapter } from '../adapters/FableAdapter.js';
import { MockFableAdapter } from '../adapters/MockFableAdapter.js';

// ── Config cache (5-minute TTL) ───────────────────────────────────────────────

interface RailsRow { key: string; value: string; who_executes?: string }

let configCache: Record<string, RailsRow> | null = null;
let configCachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getRailsConfig(): Promise<Record<string, RailsRow>> {
  if (configCache && Date.now() - configCachedAt < CACHE_TTL) return configCache;

  try {
    const { data } = await supabaseAdmin
      .from('payment_rails_config')
      .select('key, value, who_executes');
    configCache = Object.fromEntries(
      (data ?? []).map((r: RailsRow) => [r.key, r]),
    );
  } catch {
    configCache = {};
  }
  configCachedAt = Date.now();
  return configCache!;
}

export function clearRailsCache(): void {
  configCache = null;
  configCachedAt = 0;
}

function buildAdapter(value: string): IPaymentGateway {
  if (value === 'fable') return new FableAdapter();
  return new MockFableAdapter();
}

// ── Exported adapter getters ──────────────────────────────────────────────────

export async function getOutwardAdapter(): Promise<IPaymentGateway> {
  const cfg = await getRailsConfig();
  const row = cfg['outward_rail'];
  return buildAdapter(row?.value ?? 'mock');
}

export async function getInwardCollectionAdapter(): Promise<IPaymentGateway> {
  const cfg = await getRailsConfig();
  const row = cfg['inward_collection_rail'];
  return buildAdapter(row?.value ?? 'mock');
}

export async function getInwardPayoutAdapter(): Promise<IPaymentGateway> {
  // Nium is accessed through Fable — not a separate adapter
  const cfg = await getRailsConfig();
  const row = cfg['inward_payout_rail'];
  return buildAdapter(row?.value ?? 'mock');
}

// ── Who-executes labels (for DevTools + logging) ──────────────────────────────

export async function getAdapterStatus(): Promise<{
  outward: { adapter: string; whoExecutes: string; isMock: boolean; activateReal: string };
  inward_collection: { adapter: string; whoExecutes: string; isMock: boolean };
  inward_payout: { adapter: string; whoExecutes: string; isMock: boolean };
}> {
  const [a, b, c] = await Promise.all([
    getOutwardAdapter(),
    getInwardCollectionAdapter(),
    getInwardPayoutAdapter(),
  ]);
  const cfg = await getRailsConfig();

  return {
    outward: {
      adapter: a.getProviderName(),
      whoExecutes: cfg['outward_rail']?.who_executes ?? 'Fable Fintech (AD bank: Kotak/partner) + SWIFT',
      isMock: a.isMock(),
      activateReal: 'Set FABLE_API_KEY and UPDATE payment_rails_config SET value=\'fable\' WHERE key=\'outward_rail\'',
    },
    inward_collection: {
      adapter: b.getProviderName(),
      whoExecutes: cfg['inward_collection_rail']?.who_executes ?? 'Fable Fintech (Interac/EFT/wire)',
      isMock: b.isMock(),
    },
    inward_payout: {
      adapter: c.getProviderName(),
      whoExecutes: cfg['inward_payout_rail']?.who_executes ?? 'Fable Fintech → Nium (IMPS/NEFT/UPI/RTGS)',
      isMock: c.isMock(),
    },
  };
}
