import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import caPortalRoutes from './routes/caPortal';

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
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Serve static files from src/public (CA dashboard HTML)
app.use(express.static(path.resolve('src/public')));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', app: 'REPAIHUB API', version: '1.0.0' });
});

// ── CA portal routes ──────────────────────────────────────────────────────────
app.use('/ca', caPortalRoutes);

// Redirect bare /ca to the dashboard HTML
app.get('/ca', (_req, res) => {
  res.redirect('/ca-dashboard.html');
});

app.listen(PORT, () => {
  console.log(`REPAIHUB API → http://localhost:${PORT}/health`);
  console.log(`CA Portal    → http://localhost:${PORT}/ca-dashboard.html`);
});

export default app;
