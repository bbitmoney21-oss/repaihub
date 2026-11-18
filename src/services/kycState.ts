// [GREY] Authoritative KYC state — server-side only.
//
// The ONLY trusted source of a customer's verification state is the set of
// profile columns written by kycService.updateKYCStatus() after a provider
// result whose webhook signature was verified (POST /kyc/fable/callback):
//   "kycStatus", "canadaVerified", "indiaVerified", "kycVerifiedAt", "kycExpiresAt"
// (made server-only at the database level by migration 028).
//
// kyc_submissions.canada_verified / india_verified are NOT trusted: until
// migration 028 any signed-in Supabase user could write them, and the legacy
// self-attestation routes (POST /users/kyc/canada|india) and the unsigned
// POST /webhooks/fable/kyc used to set them to true without a provider result.
//
// Fail closed: a missing row, a missing/expired verification window, or a
// database error never yields "verified".
import { supabaseAdmin } from '../lib/supabaseServer';

export interface VerifiedKycState {
  canadaVerified: boolean;
  indiaVerified: boolean;
  /** Both sides verified by a provider, kycStatus === 'verified', not expired. */
  fullyVerified: boolean;
  expired: boolean;
}

export interface ProfileKycRow {
  kycStatus?: string | null;
  canadaVerified?: boolean | null;
  indiaVerified?: boolean | null;
  kycVerifiedAt?: string | null;
  kycExpiresAt?: string | null;
}

export const UNVERIFIED: Readonly<VerifiedKycState> = Object.freeze({
  canadaVerified: false,
  indiaVerified: false,
  fullyVerified: false,
  expired: false,
});

export class KycStateUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KycStateUnavailableError';
  }
}

const KYC_COLUMNS = '"kycStatus", "canadaVerified", "indiaVerified", "kycVerifiedAt", "kycExpiresAt"';

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Pure derivation — strict booleans only, verification window required. */
export function deriveKycState(row: ProfileKycRow | null | undefined, now: Date = new Date()): VerifiedKycState {
  if (!row) return { ...UNVERIFIED };
  const verifiedAt = parseDate(row.kycVerifiedAt);
  const expiresAt = parseDate(row.kycExpiresAt);
  const expired = expiresAt !== null && expiresAt.getTime() <= now.getTime();
  const windowValid =
    verifiedAt !== null && expiresAt !== null && !expired && verifiedAt.getTime() <= now.getTime();

  const canadaVerified = windowValid && row.canadaVerified === true;
  const indiaVerified = windowValid && row.indiaVerified === true;
  return {
    canadaVerified,
    indiaVerified,
    fullyVerified: canadaVerified && indiaVerified && row.kycStatus === 'verified',
    expired,
  };
}

type KycDb = Pick<typeof supabaseAdmin, 'from'>;

/** Reads the authoritative state. Throws KycStateUnavailableError on any DB problem. */
export async function getVerifiedKycState(userId: string, db: KycDb = supabaseAdmin): Promise<VerifiedKycState> {
  if (!userId) throw new KycStateUnavailableError('userId is required');
  let result: { data: unknown; error: { message: string } | null };
  try {
    result = await db.from('profiles').select(KYC_COLUMNS).eq('id', userId).maybeSingle();
  } catch (err) {
    throw new KycStateUnavailableError(err instanceof Error ? err.message : String(err));
  }
  if (result.error) throw new KycStateUnavailableError(result.error.message);
  return deriveKycState(result.data as ProfileKycRow | null);
}

/** Same, but a DB failure degrades to UNVERIFIED (for display / risk inputs). */
export async function getVerifiedKycStateOrUnverified(
  userId: string,
  context: string,
  db: KycDb = supabaseAdmin,
): Promise<VerifiedKycState> {
  try {
    return await getVerifiedKycState(userId, db);
  } catch (err) {
    console.error(`[KYC state] ${context}: treating user as unverified —`, err instanceof Error ? err.message : err);
    return { ...UNVERIFIED };
  }
}
