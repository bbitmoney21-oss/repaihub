import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabaseClient';

const router = Router();

const JWT_SECRET = () => process.env.JWT_SECRET || 'repaihub_customer_secret_change_in_production';
const ts = () => new Date().toISOString();

function issueToken(userId: string, email: string): string {
  return jwt.sign({ id: userId, email }, JWT_SECRET(), { expiresIn: '7d' });
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
    res.status(400).json({ error: 'password must be at least 8 characters', timestamp: ts() });
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, phone: phone ?? null } },
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
      res.status(409).json({ error: 'Email already registered', timestamp: ts() });
    } else {
      res.status(400).json({ error: error.message, timestamp: ts() });
    }
    return;
  }

  if (!data.user) {
    res.status(500).json({ error: 'Registration failed', timestamp: ts() });
    return;
  }

  const token = issueToken(data.user.id, data.user.email!);
  res.status(201).json({
    token,
    user: { id: data.user.id, email: data.user.email },
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid email or password', timestamp: ts() });
    return;
  }

  const token = issueToken(data.user.id, data.user.email!);
  res.json({
    token,
    user: { id: data.user.id, email: data.user.email },
    timestamp: ts(),
  });
});

export default router;
