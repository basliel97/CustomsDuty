export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AssessmentItem {
  id: string;
  line_number: number;
  hs_code_id: string;
  item_description: string;
  quantity: number;
  unit_price_foreign: number;
  total_fob_foreign: number;
  freight_foreign: number;
  insurance_foreign: number;
  cif_etb: number;
  duty_amount: number;
  excise_amount: number;
  vat_amount: number;
  surtax_amount: number;
  withholding_amount: number;
  total_item_tax_etb: number;
  notes?: string | null;
}

export interface Assessment {
  id: string;
  assessment_number: string;
  created_by_user_id: string;
  declarant_name: string;
  declarant_tin: string;
  branch_id: string;
  currency: string;
  exchange_rate_applied: number;
  total_cif_etb: number;
  total_duty_etb: number;
  total_excise_etb: number;
  total_vat_etb: number;
  total_surtax_etb: number;
  total_withholding_etb: number;
  total_scanning_fee_etb: number;
  total_payable_etb: number;
  total_paid_etb: number;
  remaining_balance_etb: number;
  status: string;
  exemption_type: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  created_at: string;
  items?: AssessmentItem[];
}

export interface DashboardStats {
  totalAssessments: number;
  statusBreakdown: { status: string; count: number }[];
  totalPayableEtb: number;
  totalCollectedEtb: number;
  submittedToday: number;
  pendingApproval: number;
  activeHsCodes: number;
  activeForexRates: number;
  activeUsers: number;
}

export interface HsCode {
  id: string;
  code: string;
  description_en: string;
  description_am?: string | null;
  unit_of_measurement: string;
  duty_rate: number;
  excise_rate: number;
  vat_rate: number;
  surtax_rate: number;
  withholding_rate: number;
  minimum_duty_floor?: number | null;
  is_exempt_eligible: boolean;
  is_capital_goods: boolean;
  is_raw_material: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface ForexRate {
  id: string;
  currency: string;
  exchange_rate_to_etb: number;
  effective_date: string;
  source?: string;
  created_by_user_id?: string | null;
  created_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type?: string;
  channel?: string;
  title?: string;
  message?: string;
  assessment_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email?: string | null;
  user_name?: string | null;
  action: string;
  entity_name?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  old_values?: unknown;
  new_values?: unknown;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  badge_number: string | null;
  branch_id: string | null;
  role: string;
  status: string;
  created_at?: string;
}