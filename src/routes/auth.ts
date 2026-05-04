import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { supabase } from '../lib/supabaseClient';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createReferralCode, recordReferralSignup } from '../services/referralService';

const router = Router();

const JWT_SECRET = () => process.env.JWT_SECRET || 'repaihub_customer_secret_change_in_production';
const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const ts = () => new Date().toISOString();
const isDev = () => process.env.NODE_ENV !== 'production';

// Build an error response body. In dev, includes a debug field with the
// underlying message so the frontend "Request failed (500)" mystery never
// happens again. In prod, only the user-safe message is sent.
function errBody(userMessage: string, debugCause?: unknown): Record<string, unknown> {
  const body: Record<string, unknown> = { error: userMessage, timestamp: ts() };
  if (isDev() && debugCause !== undefined) {
    const e = debugCause as { message?: string; code?: string; status?: number };
    body.debug = {
      message: e?.message ?? String(debugCause),
      code: e?.code,
      status: e?.status,
    };
  }
  return body;
}

function issueToken(userId: string, email: string): string {
  return jwt.sign({ id: userId, email }, JWT_SECRET(), { expiresIn: '7d' });
}

function issueRefreshToken(userId: string): string {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || (JWT_SECRET() + '_refresh');
  return jwt.sign({ id: userId, type: 'refresh' }, refreshSecret, { expiresIn: '30d' });
}

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function emailHtml(name: string, resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0B1C2C;color:#FAF6F0;">
      <h1 style="color:#E8B86D;font-size:1.5rem;margin-bottom:8px;">REPAIHUB</h1>
      <p style="color:#8BA0B4;font-size:0.85rem;margin-bottom:24px;">NRO Outward Remittance — Canada</p>
      <h2 style="font-size:1.2rem;margin-bottom:16px;">Hi ${name},</h2>
      <p style="line-height:1.7;margin-bottom:24px;">
        We received a request to reset your REPAIHUB password.
        Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
      </p>
      <a href="${resetUrl}"
        style="display:inline-block;background:#C9963A;color:#0B1C2C;padding:14px 32px;font-weight:700;font-size:0.9rem;text-decoration:none;letter-spacing:0.05em;">
        Reset Password
      </a>
      <p style="font-size:0.8rem;color:#8BA0B4;margin-top:24px;line-height:1.6;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="font-size:0.75rem;color:#4A5568;margin-top:16px;">
        REPAIHUB is a FINTRAC registered Money Services Business.
      </p>
    </div>
  `;
}

// ── Profile creation helper — resilient, logs on failure ─────────────────────
// The on_auth_user_created trigger already inserts the base profile row
// (id, email, full_name, phone) on auth.users insert. This helper layers in the
// optional auth fields IF those columns exist (migrations 004/008). Each optional
// column is set in its own update so a single missing column doesn't break the rest.
async function ensureProfile(
  userId: string,
  email: string,
  name: string,
  phone: string | null,
  passwordHash: string,
  referredByCode: string | null,
  residency: string | null = null,
): Promise<void> {
  // Step 1: ensure the base profile row exists (trigger should have done this,
  // but we upsert defensively in case the trigger isn't installed in some env).
  const basePayload: Record<string, unknown> = {
    id:        userId,
    email,
    full_name: name,
    phone:     phone ?? null,
    status:    'active',
  };
  if (residency) basePayload['residency_type'] = residency;

  const { error: baseErr } = await supabaseAdmin.from('profiles').upsert(basePayload, { onConflict: 'id' });

  if (baseErr) {
    console.error('[Auth] Base profile upsert failed:', baseErr.message);
    // The auth.users row exists — login flow has a self-heal that recreates the profile.
    return;
  }

  // Step 2: try to write password_hash if column exists (migration 004)
  const { error: pwErr } = await supabaseAdmin
    .from('profiles')
    .update({ password_hash: passwordHash })
    .eq('id', userId);
  if (pwErr) {
    // Most likely the column doesn't exist in this Supabase project — log and continue.
    // Login will still work because it falls back to Supabase auth signInWithPassword.
    console.warn('[Auth] password_hash update skipped (column likely missing — apply migration 004):', pwErr.message);
  }

  // Step 3: try to write referred_by_code if column exists (migration 008)
  if (referredByCode) {
    const { error: refErr } = await supabaseAdmin
      .from('profiles')
      .update({ referred_by_code: referredByCode })
      .eq('id', userId);
    if (refErr) {
      console.warn('[Auth] referred_by_code update skipped (column likely missing — apply migration 008):', refErr.message);
    }
  }
}

// ── POST /auth/register ───────────────────────────────────────────────────────
const VALID_RESIDENCY = ['canadian_citizen', 'permanent_resident', 'work_permit', 'oci'] as const;

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, fullName, phone, residency, referredByCode } = req.body as {
      email?: string; password?: string; name?: string; fullName?: string; phone?: string;
      residency?: string; referredByCode?: string;
    };

    const displayName = name || fullName;
    if (!email || !password || !displayName) {
      res.status(400).json({ error: 'email, password, and name are required', timestamp: ts() });
      return;
    }

    if (residency && !VALID_RESIDENCY.includes(residency as typeof VALID_RESIDENCY[number])) {
      res.status(400).json({
        error: `residency must be one of: ${VALID_RESIDENCY.join(', ')}`,
        timestamp: ts(),
      });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters', timestamp: ts() });
      return;
    }

    if (!supabaseAdminConfigured) {
      console.error('[Auth] supabaseAdminConfigured is FALSE — env vars not loaded. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      res.status(503).json(errBody('Auth service not configured', { message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing or placeholder', code: 'env_not_loaded' }));
      return;
    }

    let authData: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>['data'];
    let authError: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>['error'];

    try {
      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, phone: phone ?? null },
      });
      authData = result.data;
      authError = result.error;
    } catch (createErr: unknown) {
      // Network / unexpected throw from Supabase SDK. Log full error for ops.
      console.error('[Auth] createUser threw unexpectedly:', createErr);
      const msg = String((createErr as { message?: string })?.message ?? createErr).toLowerCase();
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('user already') ||
        msg.includes('email address has already') ||
        msg.includes('duplicate key')
      ) {
        res.status(409).json(errBody('A user with this email address has already been registered', createErr));
      } else {
        res.status(503).json(errBody('Registration service unavailable. Please try again in a moment.', createErr));
      }
      return;
    }

    if (authError) {
      // IMPORTANT: Supabase returns HTTP 422 for many reasons (weak password,
      // signup disabled, invalid email format, rate limit, AND user-already-exists).
      // We previously mapped ANY 422 to "already exists", which produced the
      // false-positive "email exists when it doesn't" symptom. Match on the
      // message text only, and surface the actual reason for everything else.
      const msg = authError.message?.toLowerCase() ?? '';
      console.error('[Auth] createUser returned error:', { code: (authError as { code?: string }).code, status: (authError as unknown as { status?: number }).status, message: authError.message });

      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('user already') ||
        msg.includes('email address has already')
      ) {
        res.status(409).json(errBody('A user with this email address has already been registered', authError));
      } else if (msg.includes('password') && (msg.includes('weak') || msg.includes('short') || msg.includes('characters'))) {
        res.status(400).json(errBody('Password does not meet requirements. Use at least 8 characters with a mix of letters and numbers.', authError));
      } else if (msg.includes('signup') && msg.includes('disabled')) {
        res.status(503).json(errBody('New signups are temporarily disabled. Please try again later.', authError));
      } else if (msg.includes('rate') || msg.includes('too many')) {
        res.status(429).json(errBody('Too many signup attempts. Please wait a few minutes and try again.', authError));
      } else if (msg.includes('invalid') && msg.includes('email')) {
        res.status(400).json(errBody('Please enter a valid email address.', authError));
      } else {
        // Surface the real reason instead of generic "400 + raw message"
        res.status(400).json(errBody(authError.message || 'Registration failed. Please try again.', authError));
      }
      return;
    }

    if (!authData?.user) {
      res.status(500).json({ error: 'Registration failed — no user returned', timestamp: ts() });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = authData.user.id;
    const residencyVal = residency ?? null;

    // CRITICAL: create profile record — resilient helper logs on failure but never blocks registration
    await ensureProfile(userId, email, displayName!, phone ?? null, passwordHash, referredByCode?.toUpperCase() ?? null, residencyVal);

    // Generate referral code + record referral relationship (never blocks registration)
    let myReferralCode: string | null = null;
    try {
      myReferralCode = await createReferralCode(userId, displayName!);
      if (referredByCode) {
        await recordReferralSignup(userId, referredByCode);
      }
    } catch (err) {
      console.error('[Auth] Referral setup failed (non-critical):', err);
    }

    const token = issueToken(userId, email);
    const refreshToken = issueRefreshToken(userId);
    res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: { id: userId, email, name: displayName, phone: phone ?? null, residency: residencyVal, status: 'active', myReferralCode },
      timestamp: ts(),
    });
  } catch (err: unknown) {
    // Capture stack + message — previously we lost the cause of every 500
    const e = err as { message?: string; stack?: string; code?: string };
    console.error('[Auth] Unhandled registration error:', {
      message: e?.message,
      code: e?.code,
      stack: e?.stack,
    });
    res.status(500).json(errBody('Registration failed. Please try again.', err));
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password required', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid email or password', timestamp: ts() });
      return;
    }
    const token = issueToken(data.user.id, data.user.email!);
    res.json({ token, user: { id: data.user.id, email: data.user.email }, timestamp: ts() });
    return;
  }

  let profile = (await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle()).data;

  // Safety net: profile record missing — auth user may exist (e.g. registration profile insert failed)
  if (!profile) {
    const { data: signInData, error: signInCheck } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (!signInCheck && signInData?.user) {
      const authUser = signInData.user;
      console.log('[Auth] Repairing missing profile for user:', authUser.id);
      const hash = await bcrypt.hash(password, 12);
      const { data: repaired } = await supabaseAdmin.from('profiles').upsert({
        id:            authUser.id,
        email,
        full_name:     (authUser.user_metadata?.full_name as string | undefined) ?? '',
        phone:         (authUser.user_metadata?.phone as string | undefined) ?? null,
        password_hash: hash,
      }, { onConflict: 'id' }).select().single();
      profile = repaired;
    }
    if (!profile) {
      res.status(401).json({ error: 'Invalid email or password', timestamp: ts() });
      return;
    }
  }

  // Account lockout check
  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000);
    res.status(429).json({
      error: `Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`,
      timestamp: ts(),
    });
    return;
  }

  let authenticated = false;

  if (profile.password_hash) {
    authenticated = await bcrypt.compare(password, profile.password_hash);
    if (!authenticated) {
      // Bcrypt mismatch — could be a post-reset state. Try Supabase auth as fallback.
      const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (!signInErr) {
        authenticated = true;
        // Re-sync bcrypt hash
        const hash = await bcrypt.hash(password, 12);
        await supabaseAdmin.from('profiles').update({ password_hash: hash }).eq('email', email);
      }
    }
  } else {
    // No hash yet (new user or post-reset) — verify via Supabase auth and migrate
    const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    authenticated = !signInErr;
    if (authenticated) {
      const hash = await bcrypt.hash(password, 12);
      await supabaseAdmin.from('profiles').update({ password_hash: hash }).eq('email', email);
    }
  }

  if (!authenticated) {
    const attempts = (profile.failed_login_attempts ?? 0) + 1;
    const updateData: Record<string, unknown> = { failed_login_attempts: attempts };
    if (attempts >= 5) {
      updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }
    await supabaseAdmin.from('profiles').update(updateData).eq('email', email);
    res.status(401).json({ error: 'Invalid email or password', timestamp: ts() });
    return;
  }

  // Reset lockout state
  await supabaseAdmin.from('profiles').update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: ts(),
  }).eq('email', email);

  // Fetch associated KYC and bank accounts.  Use allSettled so a transient
  // failure on any single side-table does NOT 500 the entire login —
  // missing KYC/bank rows just mean the customer hasn't completed those
  // steps yet (typical for fresh signups).
  type SettledRow = { data: Record<string, unknown> | null; error: { message: string } | null } | undefined;
  const settled = await Promise.allSettled([
    supabaseAdmin.from('kyc_submissions').select('*').eq('user_id', profile.id).maybeSingle(),
    supabaseAdmin.from('canada_bank_accounts').select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('india_nro_accounts').select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const safeSettled = (idx: number): { data: Record<string, unknown> | null } => {
    const r = settled[idx];
    if (r.status === 'rejected') {
      console.error(`[Auth login] side-query #${idx} rejected:`, r.reason instanceof Error ? r.reason.message : r.reason);
      return { data: null };
    }
    const v = r.value as SettledRow;
    if (v?.error) {
      console.error(`[Auth login] side-query #${idx} error:`, v.error.message);
      return { data: null };
    }
    return { data: v?.data ?? null };
  };
  const kycRes    = safeSettled(0);
  const canadaRes = safeSettled(1);
  const indiaRes  = safeSettled(2);

  const token = issueToken(profile.id, email);
  res.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      phone: profile.phone,
      residency: profile.residency ?? profile.residency_type ?? null,
      canadaBankVerified: kycRes.data?.canada_verified ?? false,
      indiaNROVerified: kycRes.data?.india_verified ?? false,
      canadaBank: canadaRes.data
        ? { institution: canadaRes.data.institution, holderName: canadaRes.data.holder_name, accountType: canadaRes.data.account_type }
        : null,
      indiaBank: indiaRes.data
        ? { bankName: indiaRes.data.bank_name, branch: indiaRes.data.branch }
        : null,
    },
    timestamp: ts(),
  });
  } catch (err: unknown) {
    console.error('[Auth] Unhandled login error:', err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(500).json(errBody('Login failed. Please try again.', err));
  }
});

// ── POST /auth/forgot-password ────────────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  // Always return 200 immediately — prevents user enumeration
  res.json({ message: 'If that email exists, a reset link has been sent.', timestamp: ts() });

  if (!email || !supabaseAdminConfigured) return;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .eq('email', email)
    .maybeSingle();

  if (!profile) return;

  // Clear password_hash so login self-heals after Supabase-side reset
  await supabaseAdmin.from('profiles').update({
    password_hash: null,
    reset_token_hash: null,
    reset_token_expiry: null,
  }).eq('id', profile.id);

  // Generate the Supabase recovery link (admin bypasses redirect allowlist)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${FRONTEND_URL()}/reset-password` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[Auth] generateLink failed:', linkError?.message);
    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${FRONTEND_URL()}/reset-password`,
    }).catch((e: unknown) => console.error('[Auth] resetPasswordForEmail failed:', e));
    return;
  }

  const actionLink = linkData.properties.action_link;

  // Try Resend first (branded email)
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'REPAIHUB <onboarding@resend.dev>';

  if (resendKey) {
    const resend = new Resend(resendKey);
    const { error: sendError } = await resend.emails.send({
      to: email,
      from: fromEmail,
      subject: 'Reset your REPAIHUB password',
      html: emailHtml(profile.full_name ?? 'there', actionLink),
    });

    if (!sendError) return;
    console.log('[Resend] Send failed, falling back to Supabase SMTP:', sendError.message);
  }

  // Fallback: Supabase native SMTP
  await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: `${FRONTEND_URL()}/reset-password`,
  }).catch((e: unknown) => console.error('[Auth] Supabase SMTP fallback failed:', e));
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, email, newPassword } = req.body as {
    token?: string; email?: string; newPassword?: string;
  };

  if (!token || !email || !newPassword) {
    res.status(400).json({ error: 'token, email, and newPassword are required', timestamp: ts() });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters', timestamp: ts() });
    return;
  }
  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Auth service not configured', timestamp: ts() });
    return;
  }

  const tokenHash = sha256(token);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, reset_token_hash, reset_token_expiry')
    .eq('email', email)
    .maybeSingle();

  if (!profile || profile.reset_token_hash !== tokenHash) {
    res.status(400).json({ error: 'Invalid or expired reset link', timestamp: ts() });
    return;
  }

  if (!profile.reset_token_expiry || new Date(profile.reset_token_expiry) < new Date()) {
    res.status(400).json({ error: 'Reset link has expired. Please request a new one.', timestamp: ts() });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await Promise.all([
    supabaseAdmin.auth.admin.updateUserById(profile.id, { password: newPassword }),
    supabaseAdmin.from('profiles').update({
      password_hash: passwordHash,
      reset_token_hash: null,
      reset_token_expiry: null,
      failed_login_attempts: 0,
      locked_until: null,
    }).eq('id', profile.id),
  ]);

  res.json({ message: 'Password updated successfully', timestamp: ts() });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!supabaseAdminConfigured) {
    res.json({ user: { id: req.userId, email: req.userEmail }, timestamp: ts() });
    return;
  }

  const userId = req.userId!;
  const isDevMe = process.env.NODE_ENV !== 'production';
  try {
    const settled = await Promise.allSettled([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('kyc_submissions').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('canada_bank_accounts').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('india_nro_accounts').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    type SettledRow = { data: Record<string, unknown> | null; error: { message: string } | null } | undefined;
    const labels = ['profile', 'kyc', 'canadaBank', 'indiaAccount'] as const;
    const debug: Array<{ table: string; status: string; error?: string }> = [];

    const extract = (idx: number): Record<string, unknown> | null => {
      const r = settled[idx];
      const label = labels[idx];
      if (r.status === 'rejected') {
        const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
        console.error(`[GET /auth/me] ${label} threw:`, reason);
        debug.push({ table: label, status: 'rejected', error: reason });
        return null;
      }
      const v = r.value as SettledRow;
      if (v?.error) {
        console.error(`[GET /auth/me] ${label} error:`, v.error.message);
        debug.push({ table: label, status: 'error', error: v.error.message });
        return null;
      }
      debug.push({ table: label, status: 'ok' });
      return v?.data ?? null;
    };

    const profile = extract(0);
    const kyc = extract(1) as Record<string, unknown> | null;
    const canada = extract(2) as Record<string, unknown> | null;
    const india = extract(3) as Record<string, unknown> | null;

    if (!profile) {
      res.status(404).json({
        error: 'Profile not found',
        timestamp: ts(),
        ...(isDevMe ? { debug } : {}),
      });
      return;
    }

    res.json({
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        phone: profile.phone,
        residency: profile.residency ?? profile.residency_type ?? null,
        canadaBankVerified: (kyc?.canada_verified as boolean | undefined) ?? false,
        indiaNROVerified: (kyc?.india_verified as boolean | undefined) ?? false,
        canadaBank: canada
          ? { institution: canada.institution, holderName: canada.holder_name, accountType: canada.account_type }
          : null,
        indiaBank: india
          ? { bankName: india.bank_name, branch: india.branch }
          : null,
      },
      timestamp: ts(),
      ...(isDevMe ? { debug } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load user';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[GET /auth/me] Unhandled error:', msg);
    if (stack) console.error(stack);
    res.status(500).json({
      error: msg,
      timestamp: ts(),
      ...(isDevMe ? { debug: { stack } } : {}),
    });
  }
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required', timestamp: ts() });
    return;
  }
  try {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || (JWT_SECRET() + '_refresh');
    const payload = jwt.verify(refreshToken, refreshSecret) as { id: string; type: string };
    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type', timestamp: ts() });
      return;
    }
    // Fetch email from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', payload.id)
      .maybeSingle();
    if (!profile) {
      res.status(401).json({ error: 'User not found', timestamp: ts() });
      return;
    }
    const token = issueToken(payload.id, profile.email as string);
    res.json({ success: true, token, timestamp: ts() });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token', timestamp: ts() });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out', timestamp: ts() });
});

export default router;
