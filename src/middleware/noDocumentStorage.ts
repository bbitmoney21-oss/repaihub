import type { Request, Response, NextFunction } from 'express';

// ── Founder's thumb rule (2026-11-20): REPAIHUB does not save or hold customer documents. ──
// Identity, PAN, bank and source-of-funds checks are done by the verification
// partners (DigiLocker / IDfy in India, Persona and Flinks-class bank
// verification in Canada). REPAIHUB keeps only the minimum data a transfer
// needs: the verification result and reference, never the document itself.
// Any route that would store a customer document is blocked with 410 Gone.
export function noDocumentStorage(_req: Request, res: Response, _next: NextFunction): void {
  res.status(410).json({
    error: 'DOCUMENT_STORAGE_DISABLED',
    message: 'REPAIHUB does not store customer documents. Verification is completed with our verification partners (DigiLocker, IDfy, Persona, bank verification); only the result is kept.',
    timestamp: new Date().toISOString(),
  });
}

/** Mask a PAN for storage/display: ABCDE1234F → XXXXXX234F. */
export function maskPan(pan: string): string {
  const p = pan.toUpperCase().trim();
  return p.length === 10 ? 'XXXXXX' + p.slice(6) : 'XXXXXXXXXX';
}
