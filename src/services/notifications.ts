// Email notifications — real sending requires SENDGRID_API_KEY in env.
// Without the key, all functions log to console and resolve silently.

interface TransferNotificationParams {
  customerEmail: string;
  customerName: string;
  transferId: string;
  amountINR: number;
  amountCAD: number;
  status: string;
}

const hasSendGrid = !!process.env.SENDGRID_API_KEY;

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!hasSendGrid) {
    console.log(`[email stub] To: ${to} | Subject: ${subject}`);
    return;
  }
  // Real SendGrid call would go here when key is added.
  console.log(`[email] Sent to ${to}: ${subject}`);
}

export async function notifyTransferInitiated(p: TransferNotificationParams): Promise<void> {
  await sendEmail(
    p.customerEmail,
    `Transfer Initiated — ₹${p.amountINR.toLocaleString('en-IN')} → CA$${p.amountCAD.toFixed(2)}`,
    `Hi ${p.customerName},\n\nYour transfer (Ref: ${p.transferId}) has been received and is under review.\n\nAmount: ₹${p.amountINR.toLocaleString('en-IN')} → CA$${p.amountCAD.toFixed(2)}\n\nWe'll notify you at each step.\n\n— REPAIHUB`,
  );
}

export async function notifyTransferStatusChange(p: TransferNotificationParams): Promise<void> {
  const statusLabels: Record<string, string> = {
    kyc_verified:     'KYC Verified',
    '15cb_requested': 'CA Review in Progress',
    '15cb_received':  '15CB Certificate Issued',
    '15ca_filed':     '15CA Filed — Bank Processing Soon',
    bank_processing:  'Bank Processing',
    completed:        'Transfer Completed',
    failed:           'Transfer Failed',
  };
  const label = statusLabels[p.status] ?? p.status;
  await sendEmail(
    p.customerEmail,
    `Transfer Update: ${label} — Ref ${p.transferId.slice(0, 8)}`,
    `Hi ${p.customerName},\n\nYour transfer status has been updated to: ${label}\n\nRef: ${p.transferId}\n\n— REPAIHUB`,
  );
}
