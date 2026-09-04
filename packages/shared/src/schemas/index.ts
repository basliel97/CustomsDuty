import { z } from "zod";
import { USER_ROLES, EXEMPTION_TYPES, CURRENCIES } from "../constants/index.js";

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  full_name: z.string().min(2, "Name is required").max(200),
  phone: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
});

// User schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2).max(200),
  phone: z.string().optional(),
  badge_number: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  full_name: z.string().min(2).max(200).optional(),
  phone: z.string().optional(),
  badge_number: z.string().optional(),
  branch_id: z.string().uuid().optional(),
});

// HS Code schemas
export const createHsCodeSchema = z.object({
  code: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/, "Code must be in format XXXX.XX.XX"),
  description_en: z.string().min(2).max(500),
  description_am: z.string().max(500).optional(),
  unit_of_measurement: z.string().min(1).max(20),
  category_id: z.string().uuid().optional(),
  duty_rate: z.number().min(0).max(1),
  excise_rate: z.number().min(0).max(2),
  vat_rate: z.number().min(0).max(1).default(0.15),
  surtax_rate: z.number().min(0).max(1).default(0.10),
  withholding_rate: z.number().min(0).max(1).default(0.03),
  minimum_duty_floor: z.number().min(0).optional(),
  is_exempt_eligible: z.boolean().default(false),
  is_capital_goods: z.boolean().default(false),
  is_raw_material: z.boolean().default(false),
});

// Forex schemas
export const createForexRateSchema = z.object({
  currency: z.enum(CURRENCIES),
  exchange_rate_to_etb: z.number().positive("Rate must be positive"),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().default("NBE"),
  notes: z.string().optional(),
});

// Assessment item schema
export const assessmentItemSchema = z.object({
  hs_code: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
  item_description: z.string().min(2).max(500),
  quantity: z.number().positive("Quantity must be positive"),
  unit_price_foreign: z.number().min(0, "Price cannot be negative"),
  freight_foreign: z.number().min(0).default(0),
  insurance_foreign: z.number().min(0).default(0),
  country_of_origin: z.string().length(3).optional(),
  notes: z.string().optional(),
});

// Assessment schemas
export const createAssessmentSchema = z.object({
  declarant_name: z.string().min(2).max(200),
  declarant_tin: z.string().min(10).max(20),
  declarant_passport_no: z.string().max(30).optional(),
  declarant_phone: z.string().max(20).optional(),
  declarant_email: z.string().email().optional(),
  branch_id: z.string().uuid(),
  port_of_entry_id: z.string().uuid().optional(),
  consignment_id: z.string().uuid().optional(),
  currency: z.enum(CURRENCIES),
  exchange_rate_applied: z.number().positive(),
  exemption_type: z.enum(EXEMPTION_TYPES).default("NONE"),
  items: z.array(assessmentItemSchema).min(1).max(50),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// Calculate schema (public quick estimate)
export const calculateSchema = z.object({
  currency: z.enum(CURRENCIES),
  exchange_rate: z.number().positive(),
  exemption_type: z.enum(EXEMPTION_TYPES).default("NONE"),
  items: z.array(
    z.object({
      hs_code: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
      quantity: z.number().positive(),
      unit_price_foreign: z.number().min(0),
      freight_foreign: z.number().min(0).default(0),
      insurance_foreign: z.number().min(0).default(0),
    })
  ).min(1),
});
