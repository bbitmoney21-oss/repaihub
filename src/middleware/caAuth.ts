import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface CARequest extends Request {
  caUser?: {
    id: string;
    email: string;
    name: string;
    icaiMembership: string;
  };
}

export function caAuthMiddleware(req: CARequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'CA authentication required', timestamp: new Date().toISOString() });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const secret = process.env.CA_JWT_SECRET || 'ca_secret_change_in_production';
    const decoded = jwt.verify(token, secret) as { id: string; email: string; name: string; icaiMembership: string };
    req.caUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired CA token', timestamp: new Date().toISOString() });
  }
}
