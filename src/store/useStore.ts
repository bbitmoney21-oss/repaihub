import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApiTransfer } from '../lib/api'

export type ResidencyStatus = 'citizen' | 'pr' | 'oci' | 'work_permit' | ''
export type TransferStatus =
  | 'INITIATED' | 'KYC_VERIFIED' | '15CA_FILED'
  | '15CB_CERTIFIED' | 'BANK_PROCESSING' | 'SWIFT_SENT'
  | 'COMPLETED' | 'FAILED'

export interface Transfer {
  id: string
  date: string
  amountINR: number
  amountCAD: number
  rate: number
  fee: number
  status: TransferStatus
  express: boolean
  reference: string
  events: { status: TransferStatus; timestamp: string; note: string }[]
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  residencyStatus: ResidencyStatus
  canadaBankVerified: boolean
  indiaNROVerified: boolean
  canadaBank?: { institution: string; holderName: string; accountType: string }
  indiaBank?: { bankName: string; branch: string }
  kycCompletedAt?: string
  annualLimitUsed: number
  annualLimitTotal: number
}

interface Notification {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  timestamp: string
}

// Map API transfer status (lowercase) → frontend TransferStatus (uppercase)
const API_STATUS_MAP: Record<string, TransferStatus> = {
  initiated:       'INITIATED',
  kyc_verified:    'KYC_VERIFIED',
  '15ca_filed':    '15CA_FILED',
  '15cb_certified':'15CB_CERTIFIED',
  bank_processing: 'BANK_PROCESSING',
  swift_sent:      'SWIFT_SENT',
  completed:       'COMPLETED',
  failed:          'FAILED',
}

export function mapApiTransfer(t: ApiTransfer): Transfer {
  const status: TransferStatus = API_STATUS_MAP[t.status.toLowerCase()] ?? 'INITIATED'
  return {
    id: t.id,
    date: t.createdAt,
    amountINR: parseFloat(t.amountInr),
    amountCAD: parseFloat(t.amountCad),
    rate: parseFloat(t.exchangeRate),
    fee: parseFloat(t.feeCad),
    status,
    express: t.speed === 'express',
    reference: `RH-${t.id.slice(0, 6).toUpperCase()}`,
    events: [{ status: 'INITIATED', timestamp: t.createdAt, note: 'Transfer initiated' }],
  }
}

interface AppState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  transfers: Transfer[]
  notifications: Notification[]
  fxRate: number
  fxLastUpdated: string

  // Actions
  setAuth: (token: string, apiUser: { id: string; email: string; residency?: string | null; status?: string }) => void
  logout: () => void
  setResidency: (status: ResidencyStatus) => void
  completeCanadaKYC: (bank: User['canadaBank']) => void
  completeIndiaKYC: (bank: User['indiaBank']) => void
  setTransfers: (ts: Transfer[]) => void
  addTransfer: (t: Transfer) => void
  updateTransfer: (id: string, updates: Partial<Transfer>) => void
  markNotificationRead: (id: string) => void
  addNotification: (n: Omit<Notification, 'id' | 'read'>) => void
  setFxRate: (rate: number) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      transfers: [],
      fxRate: 63.42,
      fxLastUpdated: new Date().toISOString(),
      notifications: [],

      setAuth: (token, apiUser) => set({
        token,
        isAuthenticated: true,
        user: {
          id: apiUser.id,
          name: apiUser.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          email: apiUser.email,
          phone: '',
          residencyStatus: (apiUser.residency as ResidencyStatus) || '',
          canadaBankVerified: false,
          indiaNROVerified: false,
          annualLimitUsed: 0,
          annualLimitTotal: 83000,
        },
      }),

      logout: () => set({
        token: null,
        isAuthenticated: false,
        user: null,
        transfers: [],
        notifications: [],
      }),

      setResidency: (status) => set(s => ({
        user: s.user ? { ...s.user, residencyStatus: status } : s.user,
      })),

      completeCanadaKYC: (bank) => set(s => ({
        user: s.user ? { ...s.user, canadaBankVerified: true, canadaBank: bank } : s.user,
      })),

      completeIndiaKYC: (bank) => set(s => ({
        user: s.user ? {
          ...s.user,
          indiaNROVerified: true,
          indiaBank: bank,
          kycCompletedAt: new Date().toISOString(),
        } : s.user,
      })),

      setTransfers: (ts) => set({ transfers: ts }),

      addTransfer: (t) => set(s => ({ transfers: [t, ...s.transfers] })),

      updateTransfer: (id, updates) => set(s => ({
        transfers: s.transfers.map(t => t.id === id ? { ...t, ...updates } : t),
      })),

      markNotificationRead: (id) => set(s => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      })),

      addNotification: (n) => set(s => ({
        notifications: [
          { ...n, id: 'n_' + Date.now(), read: false },
          ...s.notifications,
        ],
      })),

      setFxRate: (rate) => set({ fxRate: rate, fxLastUpdated: new Date().toISOString() }),
    }),
    { name: 'repaihub-store' }
  )
)
