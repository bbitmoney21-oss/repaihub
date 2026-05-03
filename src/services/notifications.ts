// Email notifications via Resend.
// Without RESEND_API_KEY, all functions log to console and resolve silently.

import { Resend } from 'resend';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'REPAIHUB <onboarding@resend.dev>';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email-mock] To: ${to} | Subject: ${subject}`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  if (error) console.error('[Resend] Send failed:', error.message);
}

interface TransferNotificationParams {
  customerEmail: string;
  customerName: string;
  transferId: string;
  amountINR: number;
  amountCAD: number;
  status: string;
}

function wrapHtml(body: string): string {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0B1C2C;color:#FAF6F0;">
    <h1 style="color:#E8B86D;font-size:1.5rem;margin-bottom:8px;">REPAIHUB</h1>
    <p style="color:#8BA0B4;font-size:0.85rem;margin-bottom:24px;">NRI Remittance — Canada ↔ India</p>
    ${body}
    <p style="font-size:0.75rem;color:#4A5568;margin-top:24px;">REPAIHUB is a FINTRAC registered Money Services Business.</p>
  </div>`;
}

export async function notifyTransferInitiated(p: TransferNotificationParams): Promise<void> {
  const html = wrapHtml(`
    <h2 style="font-size:1.1rem;margin-bottom:16px;">Hi ${p.customerName},</h2>
    <p style="line-height:1.7;margin-bottom:24px;">
      Your transfer has been received and is under compliance review.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#8BA0B4;font-size:0.85rem;">Reference</td><td style="font-weight:600;">${p.transferId.slice(0,8).toUpperCase()}</td></tr>
      <tr><td style="padding:8px 0;color:#8BA0B4;font-size:0.85rem;">Amount</td><td style="font-weight:600;">₹${p.amountINR.toLocaleString('en-IN')} → CA$${p.amountCAD.toFixed(2)}</td></tr>
    </table>
    <p style="color:#8BA0B4;font-size:0.85rem;line-height:1.6;">We'll notify you at each step. Most transfers complete within 1-2 business days.</p>
  `);
  await sendEmail(p.customerEmail, `Transfer Initiated — ₹${p.amountINR.toLocaleString('en-IN')} → CA$${p.amountCAD.toFixed(2)}`, html);
}

export async function notifyTransferStatusChange(p: TransferNotificationParams): Promise<void> {
  const statusLabels: Record<string, string> = {
    kyc_verified:        'KYC Verified — Proceeding to compliance review',
    form146_requested:   'Form 146 (CA Certificate) requested',
    form146_received:    'Form 146 Issued — Filing Form 145',
    form145_filed:       'Form 145 Filed — Bank Processing Soon',
    bank_processing:     'Bank Processing — Transfer with SWIFT',
    completed:           'Transfer Completed',
    failed:              'Transfer Failed',
    cancelled:           'Transfer Cancelled',
  };
  const normalized = p.status.toLowerCase();
  const label = statusLabels[normalized] ?? p.status;
  const isCompleted = normalized === 'completed';

  const html = wrapHtml(isCompleted ? `
    <h2 style="font-size:1.2rem;margin-bottom:8px;color:#27AE60;">Your transfer is complete!</h2>
    <p style="color:#8BA0B4;font-size:0.85rem;line-height:1.6;margin-bottom:20px;">
      Hi ${p.customerName}, your funds have been delivered to your Canadian account.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#8BA0B4;font-size:0.85rem;">Reference</td><td style="font-weight:600;">${p.transferId.slice(0,8).toUpperCase()}</td></tr>
      <tr><td style="padding:8px 0;color:#8BA0B4;font-size:0.85rem;">Amount sent</td><td style="font-weight:600;">₹${p.amountINR.toLocaleString('en-IN')}</td></tr>
      <tr><td style="padding:8px 0;color:#8BA0B4;font-size:0.85rem;">You received</td><td style="font-weight:600;color:#27AE60;">CA$${p.amountCAD.toFixed(2)}</td></tr>
    </table>
    <p style="color:#8BA0B4;font-size:0.82rem;line-height:1.6;">Tax compliance documents (Form 145 &amp; 146) are available in your REPAIHUB dashboard.</p>
  ` : `
    <h2 style="font-size:1.1rem;margin-bottom:16px;">Transfer Update: ${label}</h2>
    <p style="color:#8BA0B4;font-size:0.85rem;line-height:1.6;">
      Reference: ${p.transferId.slice(0,8).toUpperCase()}<br/>
      Amount: ₹${p.amountINR.toLocaleString('en-IN')} → CA$${p.amountCAD.toFixed(2)}
    </p>
  `);
  await sendEmail(
    p.customerEmail,
    isCompleted
      ? `Transfer Complete — CA$${p.amountCAD.toFixed(2)} delivered — Ref ${p.transferId.slice(0,8).toUpperCase()}`
      : `Transfer Update: ${label} — Ref ${p.transferId.slice(0,8).toUpperCase()}`,
    html,
  );
}
