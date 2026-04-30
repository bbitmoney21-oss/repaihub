import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  initiateCanadaKYC,
  verifyCanadaKYC,
  initiateIndiaKYC,
  verifyIndiaKYC,
  handleFableWebhook,
  getKYCStatus,
} from '../services/kycService';
import { log } from '../services/auditService';

const router = Router();
const ts = () => new Date().toISOString();

// ── POST /kyc/canada/initiate ─────────────────────────────────────────────────
router.post('/canada/initiate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const result = await initiateCanadaKYC(userId);
    void log('KYC_CANADA_INITIATED', 'customer', { userId, transferType: 'outward', metadata: { provider: result.provider } });
    res.json({ ...result, timestamp: ts() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate Canada KYC', timestamp: ts() });
  }
});

// ── POST /kyc/canada/verify ───────────────────────────────────────────────────
router.post('/canada/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { sessionId, token } = req.body as { sessionId?: string; token?: string };

  if (!sessionId || !token) {
    res.status(400).json({ error: 'sessionId and token are required', timestamp: ts() });
    return;
  }

  try {
    const result = await verifyCanadaKYC(userId, sessionId, token);
    if (result.verified) {
      void log('KYC_CANADA_VERIFIED', 'customer', { userId, metadata: { provider: result.provider } });
    } else {
      void log('KYC_FAILED', 'customer', { userId, metadata: { side: 'canada', reason: result.failureReason } });
    }
    res.json({ ...result, timestamp: ts() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify Canada KYC', timestamp: ts() });
  }
});

// ── POST /kyc/india/initiate ──────────────────────────────────────────────────
router.post('/india/initiate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const result = await initiateIndiaKYC(userId);
    void log('KYC_INDIA_INITIATED', 'customer', { userId, metadata: { provider: result.provider } });
    res.json({ ...result, timestamp: ts() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate India KYC', timestamp: ts() });
  }
});

// ── POST /kyc/india/verify ────────────────────────────────────────────────────
router.post('/india/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { sessionId, token } = req.body as { sessionId?: string; token?: string };

  if (!sessionId || !token) {
    res.status(400).json({ error: 'sessionId and token are required', timestamp: ts() });
    return;
  }

  try {
    const result = await verifyIndiaKYC(userId, sessionId, token);
    if (result.verified) {
      void log('KYC_INDIA_VERIFIED', 'customer', { userId, metadata: { provider: result.provider } });
    } else {
      void log('KYC_FAILED', 'customer', { userId, metadata: { side: 'india', reason: result.failureReason } });
    }
    res.json({ ...result, timestamp: ts() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify India KYC', timestamp: ts() });
  }
});

// ── POST /kyc/fable/callback ──────────────────────────────────────────────────
// Fable webhook — no auth, but signature verified inside handleFableWebhook
router.post('/fable/callback', async (req: Request, res: Response) => {
  const signature = req.headers['x-fable-signature'] as string || '';
  const payload = req.body as {
    sessionId: string;
    userId: string;
    type: 'canada' | 'india';
    status: 'verified' | 'failed';
    metadata?: object;
  };

  if (!payload.sessionId || !payload.userId || !payload.type || !payload.status) {
    res.status(400).json({ error: 'Invalid webhook payload' });
    return;
  }

  try {
    const ok = await handleFableWebhook(payload, signature);
    if (!ok) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
    void log(payload.status === 'verified' ? 'KYC_INDIA_VERIFIED' : 'KYC_FAILED', 'system', {
      userId: payload.userId,
      metadata: { source: 'fable_webhook', type: payload.type },
    });
    res.json({ received: true, timestamp: ts() });
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── GET /kyc/status ───────────────────────────────────────────────────────────
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const status = await getKYCStatus(userId);
    res.json({ ...status, timestamp: ts() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch KYC status', timestamp: ts() });
  }
});

export default router;
