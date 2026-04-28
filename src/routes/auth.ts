import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import { supabaseAdmin, supabaseAdminConfigured } from '../lib/supabaseServer';
import { supabase } from '../lib/supabaseClient';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const JWT_SECRET = () => process.env.JWT_SECRET || 'repaihub_customer_secret_change_in_production';
const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const ts = () => new Date().toISOString();

function issueToken(userId: string, email: string): string {
  return jwt.sign({ id: userId, email }, JWT_SECRET(), { expiresIn: '7d' });
}

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, phone } = req.body as {
    email?: string; password?: string; name?: string; phone?: string;
  };

  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required', timestamp: ts() });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters', timestamp: ts() });
    return;
  }

  if (!supabaseAdminConfigured) {
    res.status(503).json({ error: 'Auth service not configured', timestamp: ts() });
    return;
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone: phone ?? null },
  });

  if (authError) {
    const msg = authError.message?.toLowerCase() ?? '';
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
      res.status(409).json({ error: 'Email already registered', timestamp: ts() });
    } else {
      res.status(400).json({ error: authError.message, timestamp: ts() });
    }
    return;
  }

  if (!authData.user) {
    res.status(500).json({ error: 'Registration failed', timestamp: ts() });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    email,
    full_name: name,
    phone: phone ?? null,
    password_hash: passwordHash,
  }, { onConflict: 'id' });

  const token = issueToken(authData.user.id, email);
  res.status(201).json({
    token,
    user: { id: authData.user.id, email, name, phone: phone ?? null },
    timestamp: ts(),
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (profileError || !profile) {
    res.status(401).json({ error: 'Invalid email or password', timestamp: ts() });
    return;
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
  } else {
    // Legacy users registered before bcrypt migration — verify via Supabase auth
    const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    authenticated = !signInErr;
    if (authenticated) {
      // Migrate: store bcrypt hash going forward
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

  // Fetch associated KYC and bank accounts
  const [kycRes, canadaRes, indiaRes] = await Promise.all([
    supabaseAdmin.from('kyc_submissions').select('*').eq('user_id', profile.id).maybeSingle(),
    supabaseAdmin.from('canada_bank_accounts').select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('india_nro_accounts').select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const token = issueToken(profile.id, email);
  res.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      phone: profile.phone,
      residency: profile.residency,
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

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await supabaseAdmin.from('profiles').update({
    reset_token_hash: tokenHash,
    reset_token_expiry: expiry,
  }).eq('id', profile.id);

  const sgKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@repaihub.com';
  if (!sgKey) return;

  sgMail.setApiKey(sgKey);
  const resetUrl = `${FRONTEND_URL()}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  await sgMail.send({
    to: email,
    from: fromEmail,
    subject: 'Reset your REPAIHUB password',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0B1C2C;color:#FAF6F0;">
        <h1 style="color:#E8B86D;font-size:1.5rem;margin-bottom:8px;">REPAIHUB</h1>
        <p style="color:#8BA0B4;font-size:0.85rem;margin-bottom:24px;">NRO Outward Remittance — Canada</p>
        <h2 style="font-size:1.2rem;margin-bottom:16px;">Hi ${profile.full_name ?? 'there'},</h2>
        <p style="line-height:1.7;margin-bottom:24px;">
          We received a request to reset your REPAIHUB password.
          Click the button below to choose a new one. This link expires in <strong>15 minutes</strong>.
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
    `,
  }).catch((err: unknown) => console.error('[SendGrid] Failed to send reset email:', err));
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
  const [profileRes, kycRes, canadaRes, indiaRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
    supabaseAdmin.from('kyc_submissions').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('canada_bank_accounts').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('india_nro_accounts').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const p = profileRes.data;
  if (!p) {
    res.status(404).json({ error: 'Profile not found', timestamp: ts() });
    return;
  }

  res.json({
    user: {
      id: p.id,
      email: p.email,
      name: p.full_name,
      phone: p.phone,
      residency: p.residency,
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
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out', timestamp: ts() });
});

export default router;
