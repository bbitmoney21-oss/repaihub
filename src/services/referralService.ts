import { supabaseAdmin } from '../lib/supabaseServer';
import { getFeeConfig } from './feeService';

// ── Code generation ───────────────────────────────────────────────────────────

export function generateReferralCode(fullName: string): string {
  const prefix = fullName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5).padEnd(5, 'X');
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}-${suffix}`;
}

// Creates the referral_codes row for a new user. Called once on signup.
export async function createReferralCode(userId: string, fullName: string): Promise<string> {
  let code = generateReferralCode(fullName);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabaseAdmin
      .from('referral_codes')
      .insert({ user_id: userId, code });
    if (!error) return code;
    // Collision: add random suffix and retry
    code = generateReferralCode(fullName) + Math.floor(Math.random() * 9);
  }
  throw new Error('Could not generate unique referral code after 5 attempts');
}

// ── Signup: record that referee used a referral code ─────────────────────────

export async function recordReferralSignup(
  refereeUserId: string,
  referralCode: string,
): Promise<void> {
  const { data: codeData } = await supabaseAdmin
    .from('referral_codes')
    .select('user_id')
    .eq('code', referralCode.toUpperCase())
    .maybeSingle();

  if (!codeData) return;                          // unknown code — silently ignore
  if (codeData.user_id === refereeUserId) return; // self-referral — silently ignore

  await supabaseAdmin.from('referrals').upsert({
    referrer_user_id: codeData.user_id,
    referee_user_id:  refereeUserId,
    referral_code:    referralCode.toUpperCase(),
    status:           'pending',
  }, { onConflict: 'referrer_user_id,referee_user_id' });
}

// ── First transfer: reward referrer with CAD credit ───────────────────────────
// Call after a transfer is successfully created for the FIRST time.
// Exits silently if this user was not referred.

export async function processReferralReward(
  refereeUserId: string,
  transferId: string,
): Promise<void> {
  const cfg = await getFeeConfig();

  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('referee_user_id', refereeUserId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!referral) return; // not a referred user

  // Mark referral rewarded
  await supabaseAdmin.from('referrals').update({
    status:              'rewarded',
    referee_transfer_id: transferId,
    referrer_reward_cad: cfg.referralRewardReferrerCAD,
    referee_reward_type: cfg.referralRewardRefereeFlatFeeWaived ? 'flat_fee_waiver' : 'none',
    rewarded_at:         new Date().toISOString(),
  }).eq('id', referral.id);

  const rewardCAD = cfg.referralRewardReferrerCAD;

  if (rewardCAD > 0) {
    // Add credit to referrer wallet (upsert: create if first earn, else add to balance)
    const { data: existing } = await supabaseAdmin
      .from('user_credits')
      .select('balance_cad, total_earned')
      .eq('user_id', referral.referrer_user_id)
      .maybeSingle();

    await supabaseAdmin.from('user_credits').upsert({
      user_id:      referral.referrer_user_id,
      balance_cad:  (existing ? Number(existing.balance_cad) : 0) + rewardCAD,
      total_earned: (existing ? Number(existing.total_earned) : 0) + rewardCAD,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Update referral_codes aggregate counters for referrer
    const { data: codeStats } = await supabaseAdmin
      .from('referral_codes')
      .select('total_referrals, total_earned_cad')
      .eq('user_id', referral.referrer_user_id)
      .maybeSingle();

    await supabaseAdmin.from('referral_codes').update({
      total_referrals:  (codeStats?.total_referrals  ?? 0) + 1,
      total_earned_cad: (codeStats?.total_earned_cad ?? 0) + rewardCAD,
    }).eq('user_id', referral.referrer_user_id);
  }

  // Mark when referee made their first transfer
  await supabaseAdmin.from('profiles').update({
    first_transfer_at: new Date().toISOString(),
  }).eq('id', refereeUserId);
}

// ── Deduct credit after it is applied to a transfer ───────────────────────────

export async function deductUserCredit(userId: string, amountCAD: number): Promise<void> {
  if (amountCAD <= 0) return;

  const { data: existing } = await supabaseAdmin
    .from('user_credits')
    .select('balance_cad, total_spent')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) return;

  await supabaseAdmin.from('user_credits').update({
    balance_cad: Math.max(0, Number(existing.balance_cad) - amountCAD),
    total_spent: Number(existing.total_spent) + amountCAD,
    updated_at:  new Date().toISOString(),
  }).eq('user_id', userId);
}
