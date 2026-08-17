import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Customer {
  id: number;
  name: string;
  phone: string;
  points_balance: number;
  opt_in_date: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  customer_id: number;
  type: 'earn' | 'redeem';
  points: number;
  description: string;
  timestamp: string;
}

export interface Reward {
  id: number;
  name: string;
  points_required: number;
  description: string;
  active: boolean;
}

export interface Business {
  id: number;
  business_name: string;
  owner_email: string;
  whatsapp_number: string;
  twilio_config: {
    account_sid: string;
    auth_token: string;
    phone_number: string;
  };
}
