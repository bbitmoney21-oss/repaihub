import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Locked rates (in-memory for current session; Supabase persistence is optional)
interface LockedRate { userId: string; rate: number; lockedAt: string; expiresAt: string }
const lockedRates = new Map<string, LockedRate>();

function getMockRate(): number {
  // Realistic mid-market INR/CAD rate with ±0.5% intraday variation
  const base = 0.01610; // 1 INR ≈ 0.01610 CAD (62.1 CAD per 100 INR)
  const variation = (Math.random() - 0.5) * 0.0001;
  return parseFloat((base + variation).toFixed(6));
}

// ── GET /rates/inr-cad ────────────────────────────────────────────────────────
router.get('/inr-cad', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const locked = lockedRates.get(userId);
  if (locked && new Date(locked.expiresAt) > new Date()) {
    res.json({
      rate: locked.rate,
      source: 'locked',
      lockedAt: locked.lockedAt,
      expiresAt: locked.expiresAt,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const rate = getMockRate();
  const fee = 0.00015; // REPAIHUB spread
  res.json({
    rate,
    customerRate: parseFloat((rate - fee).toFixed(6)),
    spread: fee,
    source: 'mock',
    note: 'Live rates will be available at launch. Indicative only.',
    timestamp: new Date().toISOString(),
  });
});

// ── POST /rates/lock ──────────────────────────────────────────────────────────
// Locks the current rate for 15 minutes for a confirmed transfer
router.post('/lock', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rate = getMockRate();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  const locked: LockedRate = {
    userId,
    rate,
    lockedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  lockedRates.set(userId, locked);
  res.json({
    rate: locked.rate,
    lockedAt: locked.lockedAt,
    expiresAt: locked.expiresAt,
    validForMinutes: 15,
    timestamp: now.toISOString(),
  });
});

export default router;
