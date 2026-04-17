import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  annualLimitUsed: number // CAD
  annualLimitTotal: number // CAD ~1M USD converted
}

interface Notification {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  timestamp: string
}

interface AppState {
  user: User | null
  isAuthenticated: boolean
  transfers: Transfer[]
  notifications: Notification[]
  fxRate: number // INR per 1 CAD (e.g. 63.2)
  fxLastUpdated: string

  // Actions
  login: (email: string, name: string) => void
  logout: () => void
  setResidency: (status: ResidencyStatus) => void
  completeCanadaKYC: (bank: User['canadaBank']) => void
  completeIndiaKYC: (bank: User['indiaBank']) => void
  addTransfer: (t: Transfer) => void
  updateTransfer: (id: string, updates: Partial<Transfer>) => void
  markNotificationRead: (id: string) => void
  addNotification: (n: Omit<Notification, 'id' | 'read'>) => void
  setFxRate: (rate: number) => void
}

const MOCK_TRANSFERS: Transfer[] = [
  {
    id: 'TXN-2026-0042',
    date: '2026-04-02T08:30:00Z',
    amountINR: 500000,
    amountCAD: 7891.45,
    rate: 63.36,
    fee: 24.99,
    status: 'COMPLETED',
    express: false,
    reference: 'RH-042-APR',
    events: [
      { status: 'INITIATED',       timestamp: '2026-04-02T08:30:00Z', note: 'Transfer initiated by user' },
      { status: 'KYC_VERIFIED',    timestamp: '2026-04-02T08:31:15Z', note: 'KYC tokens verified' },
      { status: '15CA_FILED',      timestamp: '2026-04-02T09:05:22Z', note: 'Form 15CA filed with IT portal' },
      { status: '15CB_CERTIFIED',  timestamp: '2026-04-02T11:22:10Z', note: 'CA certified Form 15CB' },
      { status: 'BANK_PROCESSING', timestamp: '2026-04-02T12:00:00Z', note: 'Submitted to Indian bank partner' },
      { status: 'SWIFT_SENT',      timestamp: '2026-04-03T04:15:00Z', note: 'SWIFT message received' },
      { status: 'COMPLETED',       timestamp: '2026-04-03T16:42:00Z', note: 'CAD credited to your account' },
    ],
  },
  {
    id: 'TXN-2026-0039',
    date: '2026-03-15T10:00:00Z',
    amountINR: 750000,
    amountCAD: 11823.10,
    rate: 63.44,
    fee: 24.99,
    status: 'COMPLETED',
    express: true,
    reference: 'RH-039-MAR',
    events: [
      { status: 'INITIATED',       timestamp: '2026-03-15T10:00:00Z', note: 'Express transfer initiated' },
      { status: 'KYC_VERIFIED',    timestamp: '2026-03-15T10:01:30Z', note: 'KYC tokens verified' },
      { status: '15CA_FILED',      timestamp: '2026-03-15T10:30:00Z', note: 'Form 15CA filed' },
      { status: '15CB_CERTIFIED',  timestamp: '2026-03-15T12:45:00Z', note: 'CA certified Form 15CB' },
      { status: 'BANK_PROCESSING', timestamp: '2026-03-15T13:00:00Z', note: 'Processing with bank' },
      { status: 'SWIFT_SENT',      timestamp: '2026-03-15T18:00:00Z', note: 'SWIFT sent' },
      { status: 'COMPLETED',       timestamp: '2026-03-15T22:10:00Z', note: 'Completed — 12 hours express' },
    ],
  },
  {
    id: 'TXN-2026-0028',
    date: '2026-02-20T14:22:00Z',
    amountINR: 300000,
    amountCAD: 4718.10,
    rate: 63.58,
    fee: 14.99,
    status: 'COMPLETED',
    express: false,
    reference: 'RH-028-FEB',
    events: [
      { status: 'INITIATED',   timestamp: '2026-02-20T14:22:00Z', note: 'Transfer initiated' },
      { status: 'COMPLETED',   timestamp: '2026-02-22T11:00:00Z', note: 'CAD credited to your account' },
    ],
  },
]

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      transfers: MOCK_TRANSFERS,
      fxRate: 63.42,
      fxLastUpdated: new Date().toISOString(),
      notifications: [
        {
          id: 'n1',
          message: 'Your transfer TXN-2026-0042 is complete — ₹5,00,000 → CAD $7,891.45 credited.',
          type: 'success',
          read: false,
          timestamp: '2026-04-03T16:42:00Z',
        },
        {
          id: 'n2',
          message: 'Live FX rate updated: 1 CAD = ₹63.42',
          type: 'info',
          read: true,
          timestamp: '2026-04-12T08:00:00Z',
        },
      ],

      login: (email, name) => set({
        isAuthenticated: true,
        user: {
          id: 'usr_' + Date.now(),
          name, email, phone: '',
          residencyStatus: '',
          canadaBankVerified: false,
          indiaNROVerified: false,
          annualLimitUsed: 0,
          annualLimitTotal: 83000,
        },
      }),

      logout: () => set({ isAuthenticated: false, user: null, transfers: [] }),

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
