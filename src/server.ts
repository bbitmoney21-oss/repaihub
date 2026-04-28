import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import caPortalRoutes from './routes/caPortal';
import authRoutes from './routes/auth';
import ratesRoutes from './routes/rates';
import transfersRoutes from './routes/transfers';
import usersRoutes from './routes/users';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      'http://localhost:3000',
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
  res.json({ status: 'OK', app: 'REPAIHUB API', version: '1.0.0' });
});

// ── Customer API routes ───────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/rates', ratesRoutes);
app.use('/transfers', transfersRoutes);
app.use('/users', usersRoutes);

// ── CA portal routes ──────────────────────────────────────────────────────────
app.use('/ca', caPortalRoutes);

// Redirect bare /ca to the dashboard HTML
app.get('/ca', (_req, res) => {
  res.redirect('/ca-dashboard.html');
});

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
  console.log(`CA Portal    → http://localhost:${PORT}/ca-dashboard.html`)
  console.log(`Customer     → http://localhost:${PORT}/customer-dashboard.html`);
  if (fs.existsSync(distPath)) {
    console.log(`React App    → http://localhost:${PORT}/`);
  }
});

export default app;
