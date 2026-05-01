// Token helpers — stored in localStorage, sent as Bearer on every Express call
const TOKEN_KEY = 'rh_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => { localStorage.setItem(TOKEN_KEY, t); };
export const clearToken = (): void => { localStorage.removeItem(TOKEN_KEY); };

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function apiRegister(email: string, password: string, name: string, phone: string) {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, phone }),
  });
  if (!res.ok) {
    const msg = await parseError(res);
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
      throw new Error('User already registered');
    }
    throw new Error(msg);
  }
  const data = await res.json();
  setToken(data.token);
  return data.user as { id: string; email: string; name: string; phone: string | null };
}

export async function apiLogin(email: string, password: string) {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  setToken(data.token);
  return data as {
    token: string;
    user: {
      id: string; email: string; name: string; phone: string | null;
      residency: string | null;
      canadaBankVerified: boolean; indiaNROVerified: boolean;
      canadaBank: { institution: string; holderName: string; accountType: string } | null;
      indiaBank: { bankName: string; branch: string } | null;
    };
  };
}

export async function apiLogout(): Promise<void> {
  clearToken();
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
}

export async function apiRequestPasswordReset(email: string): Promise<void> {
  const res = await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function apiCompletePasswordReset(token: string, email: string, newPassword: string): Promise<void> {
  const res = await apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, email, newPassword }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

// ── Profile ───────────────────────────────────────────────────────────────────
export async function apiGetProfile() {
  const res = await apiFetch('/users/profile');
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json() as {
    profile: Record<string, unknown> | null;
    kyc: Record<string, unknown> | null;
    canadaBank: Record<string, unknown> | null;
    indiaAccount: Record<string, unknown> | null;
  };
}

export async function apiUpdateProfile(updates: Record<string, unknown>): Promise<void> {
  const res = await apiFetch('/users/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

// ── KYC ───────────────────────────────────────────────────────────────────────
export async function apiSubmitCanadaKYC(institution: string, holderName: string): Promise<void> {
  const res = await apiFetch('/users/kyc/canada', {
    method: 'POST',
    body: JSON.stringify({ institution, holderName }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function apiSubmitIndiaKYC(bankName: string, branch: string): Promise<void> {
  const res = await apiFetch('/users/kyc/india', {
    method: 'POST',
    body: JSON.stringify({ bankName, branch }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

// ── Transfers ─────────────────────────────────────────────────────────────────
export async function apiGetTransfers() {
  const res = await apiFetch('/transfers/history');
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return (data.transfers ?? []) as Record<string, unknown>[];
}

export async function apiCreateTransfer(params: {
  amountInr: number;
  amountCad: number;
  exchangeRate: number;
  feeCad: number;
  purposeCode: string;
  sourceOfFunds: string;
  speed: 'standard' | 'express';
  reference?: string;
  direction?: 'outward' | 'inward';
}) {
  const res = await apiFetch('/transfers/initiate', {
    method: 'POST',
    body: JSON.stringify({
      amountInr: params.amountInr,
      amountCad: params.amountCad,
      exchangeRate: params.exchangeRate,
      feeCad: params.feeCad,
      purposeCode: params.purposeCode,
      sourceOfFunds: params.sourceOfFunds,
      speed: params.speed,
      direction: params.direction ?? 'outward',
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.transfer as Record<string, unknown>;
}

// ── Compliance ────────────────────────────────────────────────────────────────
export async function apiGetComplianceRequests() {
  const res = await apiFetch('/compliance');
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.requests as ComplianceRequest[];
}

export async function apiGetComplianceRequest(id: string) {
  const res = await apiFetch(`/compliance/${id}`);
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json() as { request: ComplianceRequest; documents: WalletDocument[] };
}

export async function apiComplianceUploadUrl(complianceRequestId: string, params: {
  fileName: string; mimeType: string; docType: string; year?: number;
}) {
  const res = await apiFetch(`/compliance/${complianceRequestId}/upload-url`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json() as {
    tokenId: string; storagePath: string; signedUrl: string;
    complianceRequestId: string; transferId: string;
  };
}

export async function apiComplianceConfirmUpload(complianceRequestId: string, params: {
  tokenId: string; storagePath: string; fileName: string;
  mimeType: string; fileSizeBytes: number; docType: string; docLabel?: string; year?: number;
}) {
  const res = await apiFetch(`/compliance/${complianceRequestId}/confirm-upload`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json() as { document: WalletDocument };
}

// ── Wallet ────────────────────────────────────────────────────────────────────
export async function apiGetWalletDocuments(filters?: {
  year?: number; docType?: string; complianceRequestId?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.year) params.set('year', String(filters.year));
  if (filters?.docType) params.set('docType', filters.docType);
  if (filters?.complianceRequestId) params.set('complianceRequestId', filters.complianceRequestId);
  const qs = params.toString() ? `?${params}` : '';
  const res = await apiFetch(`/wallet${qs}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.documents as WalletDocument[];
}

export async function apiGetWalletDocumentUrl(tokenId: string) {
  const res = await apiFetch(`/wallet/${tokenId}/url`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { url: string; fileName: string; expiresIn: number };
}

export async function apiGetWalletYears() {
  const res = await apiFetch('/wallet/years');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()).years as number[];
}

export async function apiWalletUploadUrl(params: {
  fileName: string; mimeType: string; docType: string; year?: number;
  complianceRequestId?: string;
}) {
  const res = await apiFetch('/wallet/upload-url', { method: 'POST', body: JSON.stringify(params) });
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json() as {
    tokenId: string; storagePath: string; signedUrl: string;
    complianceRequestId: string | null;
  };
}

export async function apiWalletConfirm(params: {
  tokenId: string; storagePath: string; fileName: string;
  mimeType: string; fileSizeBytes: number; docType: string;
  docLabel?: string; year?: number; complianceRequestId?: string; transferId?: string;
}) {
  const res = await apiFetch('/wallet/confirm', { method: 'POST', body: JSON.stringify(params) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()).document as WalletDocument;
}

// ── Shared types ──────────────────────────────────────────────────────────────
export interface ComplianceRequest {
  id: string;
  transfer_id: string;
  user_id: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  fifteen_ca_part: string | null;
  fifteen_cb_required: boolean;
  fifteen_cb_number: string | null;
  fifteen_ca_number: string | null;
  ca_remarks: string | null;
  ca_reviewed_by: string | null;
  ca_reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  wallet_documents?: { count: number }[];
  transfers?: {
    id: string;
    amount_inr: number; amount_cad: number; exchange_rate: number;
    purpose_code: string; source_of_funds: string; speed: string;
    reference: string; status: string;
    commission_cad: number | null; flat_fee_cad: number | null;
    total_fees_cad: number | null; net_amount_cad: number | null;
  };
}

export interface WalletDocument {
  id: string;
  token_id: string;
  user_id: string;
  compliance_request_id: string | null;
  transfer_id: string | null;
  doc_type: string;
  doc_label: string;
  storage_path: string;
  bucket_name: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  year: number;
  uploaded_by: 'user' | 'ca';
  created_at: string;
}
