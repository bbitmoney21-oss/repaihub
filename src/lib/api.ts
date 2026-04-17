import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

const client = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use(config => {
  try {
    const raw = localStorage.getItem('repaihub-store')
    if (raw) {
      const persisted = JSON.parse(raw)
      const token: string | null = persisted?.state?.token ?? null
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
  } catch { /* ignore */ }
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────────────
export const apiRegister = (email: string, password: string, residency?: string) =>
  client.post<{ success: boolean; token: string; user: ApiUser }>('/auth/register', { email, password, residency })

export const apiLogin = (email: string, password: string) =>
  client.post<{ success: boolean; token: string; user: ApiUser }>('/auth/login', { email, password })

// ── User ──────────────────────────────────────────────────────────────────────
export const apiGetProfile = () =>
  client.get<{ success: boolean; user: ApiUser & { kyc: ApiKyc | null } }>('/user/profile')

export const apiUpdateProfile = (data: { residency?: string }) =>
  client.put<{ success: boolean; user: ApiUser }>('/user/profile', data)

// ── KYC ───────────────────────────────────────────────────────────────────────
export const apiSubmitCanadaKYC = (bankToken: string, bankName: string) =>
  client.post<{ success: boolean; kyc: ApiKyc }>('/kyc/canada', { bankToken, bankName })

export const apiSubmitIndiaKYC = (pan: string) =>
  client.post<{ success: boolean; kyc: ApiKyc }>('/kyc/india', { pan })

// ── Transfers ─────────────────────────────────────────────────────────────────
export const apiGetTransfers = (page = 1, limit = 50) =>
  client.get<{ success: boolean; transfers: ApiTransfer[]; pagination: unknown }>(`/transfers?page=${page}&limit=${limit}`)

export const apiGetTransfer = (id: string) =>
  client.get<{ success: boolean; transfer: ApiTransfer }>(`/transfers/${id}`)

export const apiCreateTransfer = (data: {
  amountCad: number
  exchangeRate: number
  purposeCode: string
  sourceOfFunds: string
  speed: 'standard' | 'express'
}) => client.post<{ success: boolean; transfer: ApiTransfer }>('/transfers', data)

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ApiUser {
  id: string
  email: string
  residency: string | null
  status: string
  createdAt?: string
}

export interface ApiKyc {
  canadaVerified: boolean
  canadaVerifiedAt?: string | null
  canadaBank?: string | null
  indiaVerified: boolean
  indiaVerifiedAt?: string | null
  expiresAt?: string | null
}

export interface ApiTransfer {
  id: string
  userId: string
  amountInr: string
  amountCad: string
  exchangeRate: string
  feeCad: string
  speed: string
  status: string
  sourceOfFunds: string | null
  purposeCode: string | null
  fintracReport: boolean
  createdAt: string
  completedAt: string | null
}
