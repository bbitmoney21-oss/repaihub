// CRITICAL: dotenv must load BEFORE any module that reads process.env at
// import time (lib/supabaseServer.ts does exactly that). The previous code
// imported routes first, then called dotenv.config() — by then the supabase
// client had already been created with placeholder env values, and every
// signup hit either a 503 ("Auth service not configured") or a 500 with no
// JSON body (network throw on the placeholder URL). The 'dotenv/config' import
// runs config() before any other import below it executes.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import caPortalRoutes from './routes/caPortal';
import authRoutes from './routes/auth';
import ratesRoutes from './routes/rates';
import transfersRoutes from './routes/transfers';
import inwardTransfersRoutes from './routes/inwardTransfers';
import usersRoutes from './routes/users';
import walletRoutes from './routes/wallet';
import complianceRoutes from './routes/compliance';
import webhooksRoutes from './routes/webhooks';
import devToolsRoutes from './routes/devTools';
import adminRoutes from './routes/admin';
import kycRoutes from './routes/kyc';

// ── Startup env check ─────────────────────────────────────────────────────────
function printEnvStatus(): void {
  const checks: { key: string; required: boolean; note: string }[] = [
    { key: 'SUPABASE_URL',              required: true,  note: 'Supabase project URL' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true,  note: 'Supabase service role — bypasses RLS' },
    { key: 'JWT_SECRET',                required: true,  note: 'Customer auth signing key' },
    { key: 'CA_JWT_SECRET',             required: true,  note: 'CA portal signing key' },
    { key: 'RESEND_API_KEY',            required: false, note: 'Missing → email notifications silently dropped' },
    { key: 'FABLE_API_KEY',             required: false, note: 'Missing → MockFableAdapter active for all payment rails' },
    { key: 'FABLE_API_URL',             required: false, note: 'Defaults to https://api.fablefintech.com/v1' },
    { key: 'FABLE_WEBHOOK_SECRET',      required: false, note: 'Missing → Fable KYC webhooks rejected (POST /kyc/fable/callback returns false)' },
    { key: 'FLINKS_CUSTOMER_ID',        required: false, note: 'Missing → Flinks widget uses demo token (Canada KYC not verified)' },
    { key: 'SETU_API_KEY',              required: false, note: 'Missing → SetuAdapter mock mode (India KYC + Reverse Penny Drop unverified)' },
    { key: 'SETU_CLIENT_ID',            required: false, note: 'Required alongside SETU_API_KEY for DigiLocker requests' },
    { key: 'API_BASE_URL',              required: false, note: 'Missing → webhook callbacks use http://localhost:3000' },
    { key: 'FRONTEND_URL',              required: false, note: 'Missing → CORS blocks non-localhost frontend origins' },
  ];
  console.log('\n=== REPAIHUB ENV CHECK ===');
  for (const { key, required, note } of checks) {
    const val = process.env[key];
    if (val) {
      console.log(`[OK]   ${key}`);
    } else if (required) {
      console.error(`[ERR]  ${key} — REQUIRED but not set`);
      process.exit(1);
    } else {
      console.log(`[MOCK] ${key} — ${note}`);
    }
  }

  const fableMode  = process.env.FABLE_API_KEY  ? 'LIVE' : 'MOCK';
  const flinksMode = process.env.FLINKS_CUSTOMER_ID ? 'LIVE' : 'MOCK';
  const emailMode  = process.env.RESEND_API_KEY ? 'LIVE' : 'NOT SET';
  const smsMode    = process.env.TWILIO_ACCOUNT_SID ? 'LIVE' : 'NOT SET';
  const rulesVer   = process.env.COMPLIANCE_RULES_VERSION ?? '2026-04-01';

  console.log(`\nFable API:    ${fableMode}`);
  console.log(`Flinks KYC:   ${flinksMode}`);
  console.log(`Email:        ${emailMode}`);
  console.log(`SMS:          ${smsMode}`);
  console.log(`RBI Rules:    v${rulesVer}`);
  console.log(`Form145 min:  Rs. ${process.env.RBI_FORM145_THRESHOLD_INR ?? '50000'}`);
  console.log(`Form146 min:  Rs. ${process.env.RBI_FORM146_THRESHOLD_INR ?? '500000'}`);
  console.log(`Annual limit: Rs. ${process.env.RBI_ANNUAL_LIMIT_INR ?? '83000000'}`);

  if (!process.env.SETU_API_KEY) {
    console.warn('\n[WARN] SETU_API_KEY not set:');
    console.warn('       → Reverse Penny Drop runs in MOCK mode');
    console.warn('       → Indian bank accounts for inward recipients are NOT verified');
    console.warn('       → India KYC (DigiLocker) runs in MOCK mode');
    console.warn('       Set SETU_API_KEY + SETU_CLIENT_ID before accepting live inward transfers.\n');
  }

  console.log('=========================\n');
}

printEnvStatus();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:19006',
      'https://repaihub.com',
      'https://www.repaihub.com',
    ];
    if (!origin) return callback(null, true);
    if (origin.endsWith('.netlify.app')) return callback(null, true);
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Serve CA portal HTML
app.use(express.static(path.resolve('src/public')));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    app: 'REPAIHUB API',
    version: '2.0.0',
    environment: process.env.NODE_ENV,
    fableMode:  process.env.FABLE_API_KEY  ? 'LIVE' : 'MOCK',
    flinksMode: process.env.FLINKS_CUSTOMER_ID ? 'LIVE' : 'MOCK',
    rbiRulesVersion:      process.env.COMPLIANCE_RULES_VERSION ?? '2026-04-01',
    form145ThresholdInr:  Number(process.env.RBI_FORM145_THRESHOLD_INR ?? 50_000),
    form146ThresholdInr:  Number(process.env.RBI_FORM146_THRESHOLD_INR ?? 500_000),
    timestamp: new Date().toISOString(),
  });
});

// ── Customer API routes ───────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/rates', ratesRoutes);
app.use('/transfers', transfersRoutes);
app.use('/inward', inwardTransfersRoutes);
app.use('/users', usersRoutes);
app.use('/wallet', walletRoutes);
app.use('/compliance', complianceRoutes);
app.use('/kyc', kycRoutes);

// ── Webhook receivers ─────────────────────────────────────────────────────────
app.use('/webhooks', webhooksRoutes);

// ── CA portal routes ──────────────────────────────────────────────────────────
app.use('/ca', caPortalRoutes);

// ── Admin routes (CA JWT protected) ──────────────────────────────────────────
app.use('/admin', adminRoutes);

// ── Dev tools (development only) ─────────────────────────────────────────────
app.use('/dev', devToolsRoutes);

// Redirect bare /ca to the dashboard HTML
app.get('/ca', (_req, res) => {
  res.redirect('/ca-dashboard.html');
});

// ── API 404 handler (before SPA fallback — catches /api/* typos) ─────────────
app.use('/auth', (_req, res) => res.status(404).json({ error: 'Auth route not found' }));
app.use('/transfers', (_req, res) => res.status(404).json({ error: 'Transfer route not found' }));
app.use('/inward', (_req, res) => res.status(404).json({ error: 'Inward transfer route not found' }));
app.use('/rates', (_req, res) => res.status(404).json({ error: 'Rate route not found' }));

// ── Serve React frontend (production build) ───────────────────────────────────
const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback — any route not matched above serves index.html
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`REPAIHUB API → http://localhost:${PORT}/health`);
  console.log(`CA Portal    → http://localhost:${PORT}/ca-dashboard.html`);
  console.log(`Customer     → http://localhost:${PORT}/customer-dashboard.html`);
  if (fs.existsSync(distPath)) {
    console.log(`React App    → http://localhost:${PORT}/`);
  }
});

export default app;
