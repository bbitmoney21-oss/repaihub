// Outward (India → Canada) pricing — single source of truth for the web app,
// the landing calculator, the help assistant and the server fee engine.
//
// Decided 20 Nov 2026 by the Financial Analyst agent under the founder's
// delegation (see repaihub-agent-team/results/finance/pricing-decision-2026-11-20.md).
//
// Fee = base fee of the slab the amount falls in
//     + a markup that is MARGINAL, like tax brackets: each slab's rate applies
//       only to the part of the amount inside that slab — no cliff at ₹5L.
// The live values come from Supabase `outward_fee_tiers`; DEFAULT_SLABS mirrors
// them for the public calculator and as the first-paint value in the app.

export type Speed = 'standard' | 'express'

export interface PricingSlab {
  slabMinInr: number
  slabMaxInr: number | null      // null = no upper bound
  rate: number                   // standard markup, fraction (0.0105 = 1.05%)
  baseCAD: number                // standard base fee
  expressRate: number            // express markup, fraction
  expressBaseCAD: number         // express base fee
  label: string
}

export const DEFAULT_SLABS: PricingSlab[] = [
  { slabMinInr: 0,         slabMaxInr: 500_000,   rate: 0.0105, baseCAD: 9.99,  expressRate: 0.0117, expressBaseCAD: 10.99, label: 'Up to ₹5 lakh' },
  { slabMinInr: 500_001,   slabMaxInr: 2_500_000, rate: 0.0120, baseCAD: 14.99, expressRate: 0.0122, expressBaseCAD: 15.99, label: '₹5 lakh – ₹25 lakh' },
  { slabMinInr: 2_500_001, slabMaxInr: null,      rate: 0.0122, baseCAD: 24.99, expressRate: 0.0118, expressBaseCAD: 29.99, label: 'Above ₹25 lakh' },
]

export const SPEED_DAYS: Record<Speed, string> = { standard: 'up to 5 business days', express: 'up to 3 business days' }

export interface OutwardFee {
  slab: PricingSlab
  baseCAD: number
  markupCAD: number
  totalCAD: number
  effectivePct: number           // total fee as % of the gross CAD amount
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Marginal outward fee. `inrPerCad` is the exchange rate (INR per 1 CAD). */
export function outwardFee(amountInr: number, inrPerCad: number, speed: Speed = 'standard', slabs: PricingSlab[] = DEFAULT_SLABS): OutwardFee {
  const sorted = [...slabs].sort((a, b) => a.slabMinInr - b.slabMinInr)
  const amt = Math.max(0, amountInr)
  let markupInr = 0
  let lower = 0
  let slab = sorted[0]
  for (const s of sorted) {
    const upper = s.slabMaxInr ?? Infinity
    const portion = Math.max(0, Math.min(amt, upper) - lower)
    if (portion > 0) {
      markupInr += portion * (speed === 'express' ? s.expressRate : s.rate)
      slab = s
    }
    lower = upper
  }
  const baseCAD = speed === 'express' ? slab.expressBaseCAD : slab.baseCAD
  const markupCAD = inrPerCad > 0 ? round2(markupInr / inrPerCad) : 0
  const totalCAD = round2(baseCAD + markupCAD)
  const grossCAD = inrPerCad > 0 ? amt / inrPerCad : 0
  return { slab, baseCAD, markupCAD, totalCAD, effectivePct: grossCAD > 0 ? round2((totalCAD / grossCAD) * 100) : 0 }
}

/** "CAD 9.99 + 1.05%" for display. */
export function slabPriceText(s: PricingSlab, speed: Speed): string {
  const base = speed === 'express' ? s.expressBaseCAD : s.baseCAD
  const rate = speed === 'express' ? s.expressRate : s.rate
  return `CAD ${base.toFixed(2)} + ${(rate * 100).toFixed(2)}%`
}
