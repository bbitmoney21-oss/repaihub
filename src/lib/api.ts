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
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.transfer as Record<string, unknown>;
}
