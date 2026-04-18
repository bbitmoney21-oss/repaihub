import { supabase } from './supabase'

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function apiRegister(email: string, password: string, name: string, phone: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  if (!data.user) throw new Error('Registration failed')
  const { error: pe } = await supabase.from('profiles').insert({
    id: data.user.id, email, full_name: name, phone,
  })
  if (pe) throw pe
  return data.user
}

export async function apiLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const apiLogout = () => supabase.auth.signOut()

// ── Profile (returns profile + kyc + bank accounts) ───────────────────────────
export async function apiGetProfile() {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')

  const [profileRes, kycRes, canadaRes, indiaRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', authUser.id).single(),
    supabase.from('kyc_submissions').select('*').eq('user_id', authUser.id).maybeSingle(),
    supabase.from('canada_bank_accounts').select('*').eq('user_id', authUser.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('india_nro_accounts').select('*').eq('user_id', authUser.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return {
    profile: profileRes.data,
    kyc: kycRes.data,
    canadaBank: canadaRes.data,
    indiaAccount: indiaRes.data,
  }
}

export async function apiUpdateProfile(updates: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
  if (error) throw error
}

// ── KYC ───────────────────────────────────────────────────────────────────────
export async function apiSubmitCanadaKYC(institution: string, holderName: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('canada_bank_accounts').insert({
    user_id: user.id, institution, holder_name: holderName, account_type: 'Chequing',
  })
  if (error) throw error
  await supabase.from('kyc_submissions').upsert(
    { user_id: user.id, canada_verified: true, canada_verified_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}

export async function apiSubmitIndiaKYC(bankName: string, branch: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('india_nro_accounts').insert({
    user_id: user.id, bank_name: bankName, branch,
  })
  if (error) throw error
  await supabase.from('kyc_submissions').upsert(
    { user_id: user.id, india_verified: true, india_verified_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}

// ── Transfers ─────────────────────────────────────────────────────────────────
export async function apiGetTransfers() {
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function apiCreateTransfer(params: {
  amountInr: number
  amountCad: number
  exchangeRate: number
  feeCad: number
  purposeCode: string
  sourceOfFunds: string
  speed: 'standard' | 'express'
  reference: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: transfer, error } = await supabase
    .from('transfers')
    .insert({
      user_id: user.id,
      amount_inr: params.amountInr,
      amount_cad: params.amountCad,
      exchange_rate: params.exchangeRate,
      fee_cad: params.feeCad,
      purpose_code: params.purposeCode,
      source_of_funds: params.sourceOfFunds,
      speed: params.speed,
      reference: params.reference,
      status: 'initiated',
    })
    .select()
    .single()

  if (error) throw error

  await supabase.from('transfer_events').insert({
    transfer_id: transfer.id,
    user_id: user.id,
    status: 'initiated',
    note: 'Transfer initiated',
  })

  return transfer
}
