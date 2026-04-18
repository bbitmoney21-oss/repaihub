import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

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

const STATUS_MAP: Record<string, TransferStatus> = {
  initiated:        'INITIATED',
  kyc_verified:     'KYC_VERIFIED',
  '15ca_filed':     '15CA_FILED',
  '15cb_certified': '15CB_CERTIFIED',
  bank_processing:  'BANK_PROCESSING',
  swift_sent:       'SWIFT_SENT',
  completed:        'COMPLETED',
  failed:           'FAILED',
}

export interface DbTransfer {
  id: string
  user_id: string
  amount_inr: number
  amount_cad: number
  exchange_rate: number
  fee_cad: number
  speed: string
  status: string
  source_of_funds: string | null
  purpose_code: string | null
  reference: string | null
  created_at: string
  completed_at: string | null
}

export function mapDbTransfer(t: DbTransfer): Transfer {
  const status: TransferStatus = STATUS_MAP[t.status?.toLowerCase() ?? 'initiated'] ?? 'INITIATED'
  return {
    id: t.id,
    date: t.created_at,
    amountINR: Number(t.amount_inr),
    amountCAD: Number(t.amount_cad),
    rate: Number(t.exchange_rate),
    fee: Number(t.fee_cad),
    status,
    express: t.speed === 'express',
    reference: t.reference ?? `RH-${t.id.slice(0, 6).toUpperCase()}`,
    events: [{ status: 'INITIATED', timestamp: t.created_at, note: 'Transfer initiated' }],
  }
}

export interface SetAuthParams {
  id: string
  email: string
  name?: string
  phone?: string
  residency?: string | null
  canadaBankVerified?: boolean
  indiaNROVerified?: boolean
  canadaBank?: User['canadaBank']
  indiaBank?: User['indiaBank']
}

interface AppState {
  user: User | null
  isAuthenticated: boolean
  transfers: Transfer[]
  notifications: Notification[]
  fxRate: number
  fxLastUpdated: string

  setAuth: (u: SetAuthParams) => void
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
      user: null,
      isAuthenticated: false,
      transfers: [],
      fxRate: 63.42,
      fxLastUpdated: new Date().toISOString(),
      notifications: [],

      setAuth: (u) => set(s => ({
        isAuthenticated: true,
        user: {
          id: u.id,
          name: u.name || u.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          email: u.email,
          phone: u.phone || s.user?.phone || '',
          residencyStatus: (u.residency as ResidencyStatus) || s.user?.residencyStatus || '',
          canadaBankVerified: u.canadaBankVerified ?? s.user?.canadaBankVerified ?? false,
          indiaNROVerified: u.indiaNROVerified ?? s.user?.indiaNROVerified ?? false,
          canadaBank: u.canadaBank ?? s.user?.canadaBank,
          indiaBank: u.indiaBank ?? s.user?.indiaBank,
          kycCompletedAt: s.user?.kycCompletedAt,
          annualLimitUsed: s.user?.annualLimitUsed ?? 0,
          annualLimitTotal: s.user?.annualLimitTotal ?? 83000,
        },
      })),

      logout: () => {
        supabase.auth.signOut()
        set({ isAuthenticated: false, user: null, transfers: [], notifications: [] })
      },

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
        notifications: [{ ...n, id: 'n_' + Date.now(), read: false }, ...s.notifications],
      })),

      setFxRate: (rate) => set({ fxRate: rate, fxLastUpdated: new Date().toISOString() }),

      // silence unused-var warning for get
      _get: get,
    }),
    { name: 'repaihub-store' }
  )
)
