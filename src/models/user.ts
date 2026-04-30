// [GREY] User model — TypeScript interfaces matching Supabase profiles table

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  residency_type: 'work_permit' | 'permanent_resident' | 'visitor' | 'citizen' | null;
  kyc_status: 'pending' | 'verified' | 'failed' | null;
  kyc_verified_at: string | null;
  referral_code: string | null;
  created_at: string;
}
