import {
  pgTable, uuid, varchar, text, timestamp, integer,
  decimal, boolean, jsonb, date, uniqueIndex, index,
} from "drizzle-orm/pg-core";

// ============================================================
// ENUMS (as varchar with check constraints for Drizzle compat)
// ============================================================

export const userRoles = ["IMPORTER", "VALUATION_OFFICER", "TARIFF_SPECIALIST", "SUPER_ADMIN"] as const;
export const userStatuses = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "LOCKED"] as const;
export const assessmentStatuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "PAID", "PARTIALLY_PAID", "EXPIRED", "CANCELLED", "APPEALED"] as const;
export const exemptionTypes = ["NONE", "DIASPORA", "INVESTMENT", "DIPLOMATIC"] as const;
export const notificationTypes = ["EMAIL", "SMS", "IN_APP"] as const;
export const notificationStatuses = ["PENDING", "SENT", "FAILED", "READ", "BOUNCED"] as const;
export const documentTypes = ["EXEMPTION_CERTIFICATE", "EIC_APPROVAL", "COMMERCIAL_INVOICE", "PACKING_LIST", "BILL_OF_LADING", "AIRWAY_BILL", "CERTIFICATE_OF_ORIGIN", "INSURANCE_CERTIFICATE", "IMPORT_PERMIT", "OTHER"] as const;
export const paymentStatuses = ["PENDING", "CONFIRMED", "FAILED", "REFUNDED"] as const;
export const paymentMethods = ["BANK_TRANSFER", "CASH", "MOBILE_MONEY", "CHEQUE"] as const;
export const appealStatuses = ["FILED", "UNDER_REVIEW", "UPHELD", "OVERTURNED", "DISMISSED"] as const;
export const scanResults = ["CLEARED", "FLAGGED_FOR_INSPECTION", "HELD", "RELEASED"] as const;
export const sessionStatuses = ["ACTIVE", "EXPIRED", "REVOKED"] as const;
export const portTypes = ["AIRPORT", "SEAPORT", "DRY_PORT", "LAND_BORDER"] as const;
export const configValueTypes = ["STRING", "NUMBER", "BOOLEAN", "JSON"] as const;

// ============================================================
// HELPER: common columns
// ============================================================

export const timestamps = {
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const softDelete = {
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
};

// ============================================================
// 1. USERS
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  badge_number: varchar("badge_number", { length: 50 }).unique(),
  branch_id: uuid("branch_id").references(() => branches.id),
  role: varchar("role", { length: 30 }).notNull().default("IMPORTER"),
  status: varchar("status", { length: 30 }).notNull().default("PENDING_VERIFICATION"),
  last_login_at: timestamp("last_login_at", { withTimezone: true }),
  failed_login_count: integer("failed_login_count").notNull().default(0),
  locked_until: timestamp("locked_until", { withTimezone: true }),
  password_changed_at: timestamp("password_changed_at", { withTimezone: true }),
  avatar_url: text("avatar_url"),
  version: integer("version").notNull().default(1),
  ...timestamps,
  ...softDelete,
});

// ============================================================
// 2. BRANCHES
// ============================================================

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 10 }).unique().notNull(),
  name_en: varchar("name_en", { length: 200 }).notNull(),
  name_am: varchar("name_am", { length: 200 }),
  address: text("address"),
  city: varchar("city", { length: 100 }).notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  is_active: boolean("is_active").notNull().default(true),
  ...timestamps,
  ...softDelete,
});

// ============================================================
// 3. COUNTRIES
// ============================================================

export const countries = pgTable("countries", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 3 }).unique().notNull(),
  name_en: varchar("name_en", { length: 200 }).notNull(),
  name_am: varchar("name_am", { length: 200 }),
  region: varchar("region", { length: 100 }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 4. PORTS
// ============================================================

export const ports = pgTable("ports", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 10 }).unique().notNull(),
  name_en: varchar("name_en", { length: 200 }).notNull(),
  name_am: varchar("name_am", { length: 200 }),
  type: varchar("type", { length: 20 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  branch_id: uuid("branch_id").references(() => branches.id),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 5. COMMODITY CATEGORIES
// ============================================================

export const commodityCategories = pgTable("commodity_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  parent_id: uuid("parent_id").references((): any => commodityCategories.id),
  code: varchar("code", { length: 10 }).unique().notNull(),
  name_en: varchar("name_en", { length: 300 }).notNull(),
  name_am: varchar("name_am", { length: 300 }),
  description: text("description"),
  level: integer("level").notNull().default(0),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  ...timestamps,
});

// ============================================================
// 6. HS CODES
// ============================================================

export const hsCodes = pgTable("hs_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  category_id: uuid("category_id").references(() => commodityCategories.id),
  code: varchar("code", { length: 10 }).unique().notNull(),
  description_en: text("description_en").notNull(),
  description_am: text("description_am"),
  unit_of_measurement: varchar("unit_of_measurement", { length: 20 }).notNull(),
  duty_rate: decimal("duty_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  excise_rate: decimal("excise_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  vat_rate: decimal("vat_rate", { precision: 6, scale: 4 }).notNull().default("0.15"),
  surtax_rate: decimal("surtax_rate", { precision: 6, scale: 4 }).notNull().default("0.10"),
  withholding_rate: decimal("withholding_rate", { precision: 6, scale: 4 }).notNull().default("0.03"),
  minimum_duty_floor: decimal("minimum_duty_floor", { precision: 14, scale: 2 }),
  is_exempt_eligible: boolean("is_exempt_eligible").notNull().default(false),
  is_capital_goods: boolean("is_capital_goods").notNull().default(false),
  is_raw_material: boolean("is_raw_material").notNull().default(false),
  is_active: boolean("is_active").notNull().default(true),
  version: integer("version").notNull().default(1),
  ...timestamps,
  ...softDelete,
}, (table) => [
  index("hs_codes_code_idx").on(table.code),
  index("hs_codes_category_idx").on(table.category_id, table.is_active),
]);

// ============================================================
// 7. FOREX RATES
// ============================================================

export const forexRates = pgTable("forex_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  currency: varchar("currency", { length: 3 }).notNull(),
  exchange_rate_to_etb: decimal("exchange_rate_to_etb", { precision: 14, scale: 4 }).notNull(),
  previous_rate: decimal("previous_rate", { precision: 14, scale: 4 }),
  change_amount: decimal("change_amount", { precision: 14, scale: 4 }),
  change_percentage: decimal("change_percentage", { precision: 8, scale: 4 }),
  effective_date: date("effective_date").notNull(),
  set_by_user_id: uuid("set_by_user_id").references(() => users.id).notNull(),
  source: varchar("source", { length: 100 }).default("NBE"),
  notes: text("notes"),
  ...timestamps,
  ...softDelete,
}, (table) => [
  uniqueIndex("forex_rates_currency_date_idx").on(table.currency, table.effective_date),
]);

// ============================================================
// 8. CONSIGNMENTS
// ============================================================

export const consignments = pgTable("consignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  consignment_number: varchar("consignment_number", { length: 30 }).unique().notNull(),
  assessment_id: uuid("assessment_id"),
  origin_country_id: uuid("origin_country_id").references(() => countries.id).notNull(),
  port_of_entry_id: uuid("port_of_entry_id").references(() => ports.id).notNull(),
  vessel_name: varchar("vessel_name", { length: 200 }),
  vessel_voyage: varchar("vessel_voyage", { length: 50 }),
  container_number: varchar("container_number", { length: 30 }),
  container_count: integer("container_count").notNull().default(1),
  container_type: varchar("container_type", { length: 30 }),
  gross_weight_kg: decimal("gross_weight_kg", { precision: 14, scale: 4 }),
  net_weight_kg: decimal("net_weight_kg", { precision: 14, scale: 4 }),
  total_packages: integer("total_packages"),
  bl_number: varchar("bl_number", { length: 50 }),
  awb_number: varchar("awb_number", { length: 50 }),
  eta_date: date("eta_date"),
  atd_date: date("atd_date"),
  ata_date: date("ata_date"),
  status: varchar("status", { length: 30 }).notNull().default("IN_TRANSIT"),
  notes: text("notes"),
  ...timestamps,
  ...softDelete,
});

// ============================================================
// 9. ASSESSMENTS
// ============================================================

export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_number: varchar("assessment_number", { length: 30 }).unique().notNull(),
  consignment_id: uuid("consignment_id").references(() => consignments.id),
  created_by_user_id: uuid("created_by_user_id").references(() => users.id).notNull(),
  declarant_name: varchar("declarant_name", { length: 200 }).notNull(),
  declarant_tin: varchar("declarant_tin", { length: 20 }).notNull(),
  declarant_passport_no: varchar("declarant_passport_no", { length: 30 }),
  declarant_phone: varchar("declarant_phone", { length: 20 }),
  declarant_email: varchar("declarant_email", { length: 255 }),
  branch_id: uuid("branch_id").references(() => branches.id).notNull(),
  port_of_entry_id: uuid("port_of_entry_id").references(() => ports.id),
  currency: varchar("currency", { length: 3 }).notNull(),
  exchange_rate_applied: decimal("exchange_rate_applied", { precision: 14, scale: 4 }).notNull(),
  total_cif_etb: decimal("total_cif_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  total_duty_etb: decimal("total_duty_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  total_excise_etb: decimal("total_excise_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  total_vat_etb: decimal("total_vat_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  total_surtax_etb: decimal("total_surtax_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  total_withholding_etb: decimal("total_withholding_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  total_scanning_fee_etb: decimal("total_scanning_fee_etb", { precision: 14, scale: 2 }).notNull().default("200"),
  total_payable_etb: decimal("total_payable_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  total_paid_etb: decimal("total_paid_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  remaining_balance_etb: decimal("remaining_balance_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 30 }).notNull().default("DRAFT"),
  exemption_type: varchar("exemption_type", { length: 20 }).notNull().default("NONE"),
  exemption_doc_id: uuid("exemption_doc_id"),
  submitted_at: timestamp("submitted_at", { withTimezone: true }),
  reviewed_by_officer_id: uuid("reviewed_by_officer_id").references(() => users.id),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  rejection_reason: text("rejection_reason"),
  qr_verification_hash: varchar("qr_verification_hash", { length: 500 }).unique(),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  payment_reference: varchar("payment_reference", { length: 100 }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  idempotency_key: varchar("idempotency_key", { length: 100 }).unique(),
  version: integer("version").notNull().default(1),
  ...timestamps,
  ...softDelete,
}, (table) => [
  index("assessments_status_idx").on(table.status),
  index("assessments_tin_idx").on(table.declarant_tin),
  index("assessments_branch_idx").on(table.branch_id),
  index("assessments_created_by_idx").on(table.created_by_user_id),
  index("assessments_officer_idx").on(table.reviewed_by_officer_id),
  index("assessments_created_at_idx").on(table.created_at),
  index("assessments_submitted_idx").on(table.submitted_at),
]);

// ============================================================
// 10. ASSESSMENT ITEMS
// ============================================================

export const assessmentItems = pgTable("assessment_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_id: uuid("assessment_id").references(() => assessments.id).notNull(),
  line_number: integer("line_number").notNull(),
  hs_code_id: uuid("hs_code_id").references(() => hsCodes.id).notNull(),
  item_description: text("item_description").notNull(),
  country_of_origin_id: uuid("country_of_origin_id").references(() => countries.id),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
  unit_price_foreign: decimal("unit_price_foreign", { precision: 14, scale: 4 }).notNull(),
  total_fob_foreign: decimal("total_fob_foreign", { precision: 14, scale: 2 }).notNull().default("0"),
  freight_foreign: decimal("freight_foreign", { precision: 14, scale: 2 }).notNull().default("0"),
  insurance_foreign: decimal("insurance_foreign", { precision: 14, scale: 2 }).notNull().default("0"),
  cif_etb: decimal("cif_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  duty_amount: decimal("duty_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  excise_amount: decimal("excise_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  vat_amount: decimal("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  surtax_amount: decimal("surtax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  withholding_amount: decimal("withholding_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total_item_tax_etb: decimal("total_item_tax_etb", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  ...timestamps,
  ...softDelete,
}, (table) => [
  uniqueIndex("assessment_items_line_idx").on(table.assessment_id, table.line_number),
]);

// ============================================================
// 11. ASSESSMENT DOCUMENTS
// ============================================================

export const assessmentDocuments = pgTable("assessment_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_id: uuid("assessment_id").references(() => assessments.id).notNull(),
  document_type: varchar("document_type", { length: 30 }).notNull(),
  file_name: varchar("file_name", { length: 255 }).notNull(),
  file_path: text("file_path").notNull(),
  file_size_bytes: integer("file_size_bytes").notNull(),
  mime_type: varchar("mime_type", { length: 100 }).notNull(),
  uploaded_by_id: uuid("uploaded_by_id").references(() => users.id).notNull(),
  is_verified: boolean("is_verified").notNull().default(false),
  verified_by_id: uuid("verified_by_id").references(() => users.id),
  verified_at: timestamp("verified_at", { withTimezone: true }),
  rejection_reason: text("rejection_reason"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

// ============================================================
// 12. ASSESSMENT STATUS HISTORY
// ============================================================

export const assessmentStatusHistory = pgTable("assessment_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_id: uuid("assessment_id").references(() => assessments.id).notNull(),
  from_status: varchar("from_status", { length: 30 }),
  to_status: varchar("to_status", { length: 30 }).notNull(),
  changed_by_id: uuid("changed_by_id").references(() => users.id).notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 13. ASSESSMENT COMMENTS
// ============================================================

export const assessmentComments = pgTable("assessment_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_id: uuid("assessment_id").references(() => assessments.id).notNull(),
  parent_id: uuid("parent_id").references((): any => assessmentComments.id),
  author_id: uuid("author_id").references(() => users.id).notNull(),
  body: text("body").notNull(),
  is_internal: boolean("is_internal").notNull().default(false),
  is_read: boolean("is_read").notNull().default(false),
  ...timestamps,
  ...softDelete,
});

// ============================================================
// 14. PAYMENT RECORDS
// ============================================================

export const paymentRecords = pgTable("payment_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_id: uuid("assessment_id").references(() => assessments.id).notNull(),
  payment_number: varchar("payment_number", { length: 30 }).unique().notNull(),
  amount_etb: decimal("amount_etb", { precision: 14, scale: 2 }).notNull(),
  payment_method: varchar("payment_method", { length: 20 }).notNull(),
  payment_status: varchar("payment_status", { length: 20 }).notNull().default("PENDING"),
  bank_name: varchar("bank_name", { length: 200 }),
  bank_reference: varchar("bank_reference", { length: 100 }),
  receipt_number: varchar("receipt_number", { length: 100 }),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  confirmed_by_id: uuid("confirmed_by_id").references(() => users.id),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true }),
  notes: text("notes"),
  ...timestamps,
  ...softDelete,
});

// ============================================================
// 15. SCANNING REPORTS
// ============================================================

export const scanningReports = pgTable("scanning_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_id: uuid("assessment_id").references(() => assessments.id).notNull(),
  report_number: varchar("report_number", { length: 30 }).unique().notNull(),
  scanned_by_id: uuid("scanned_by_id").references(() => users.id).notNull(),
  scan_date: timestamp("scan_date", { withTimezone: true }).notNull(),
  scan_result: varchar("scan_result", { length: 30 }).notNull(),
  physical_inspection: boolean("physical_inspection").notNull().default(false),
  inspection_notes: text("inspection_notes"),
  discrepancies_found: boolean("discrepancies_found").notNull().default(false),
  discrepancy_details: text("discrepancy_details"),
  weight_verified_kg: decimal("weight_verified_kg", { precision: 14, scale: 4 }),
  package_count_verified: integer("package_count_verified"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 16. ASSESSMENT APPEALS
// ============================================================

export const assessmentAppeals = pgTable("assessment_appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessment_id: uuid("assessment_id").references(() => assessments.id).notNull(),
  appeal_number: varchar("appeal_number", { length: 30 }).unique().notNull(),
  filed_by_id: uuid("filed_by_id").references(() => users.id).notNull(),
  filed_reason: text("filed_reason").notNull(),
  supporting_docs: jsonb("supporting_docs"),
  status: varchar("status", { length: 20 }).notNull().default("FILED"),
  assigned_to_id: uuid("assigned_to_id").references(() => users.id),
  resolution: text("resolution"),
  adjusted_amount: decimal("adjusted_amount", { precision: 14, scale: 2 }),
  filed_at: timestamp("filed_at", { withTimezone: true }).notNull().defaultNow(),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps,
  ...softDelete,
});

// ============================================================
// 17. RATE OVERRIDES
// ============================================================

export const rateOverrides = pgTable("rate_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  hs_code_id: uuid("hs_code_id").references(() => hsCodes.id).notNull(),
  tax_component: varchar("tax_component", { length: 20 }).notNull(),
  override_rate: decimal("override_rate", { precision: 6, scale: 4 }).notNull(),
  valid_from: date("valid_from").notNull(),
  valid_to: date("valid_to"),
  decree_reference: varchar("decree_reference", { length: 200 }).notNull(),
  reason: text("reason"),
  created_by_id: uuid("created_by_id").references(() => users.id).notNull(),
  is_active: boolean("is_active").notNull().default(true),
  ...timestamps,
  ...softDelete,
});

// ============================================================
// 18. DAILY SUMMARIES
// ============================================================

export const dailySummaries = pgTable("daily_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  summary_date: date("summary_date").notNull(),
  branch_id: uuid("branch_id").references(() => branches.id).notNull(),
  total_assessments: integer("total_assessments").notNull().default(0),
  submitted_count: integer("submitted_count").notNull().default(0),
  approved_count: integer("approved_count").notNull().default(0),
  rejected_count: integer("rejected_count").notNull().default(0),
  total_cif_etb: decimal("total_cif_etb", { precision: 16, scale: 2 }).notNull().default("0"),
  total_revenue_etb: decimal("total_revenue_etb", { precision: 16, scale: 2 }).notNull().default("0"),
  total_duty_etb: decimal("total_duty_etb", { precision: 16, scale: 2 }).notNull().default("0"),
  total_vat_etb: decimal("total_vat_etb", { precision: 16, scale: 2 }).notNull().default("0"),
  total_excise_etb: decimal("total_excise_etb", { precision: 16, scale: 2 }).notNull().default("0"),
  total_surtax_etb: decimal("total_surtax_etb", { precision: 16, scale: 2 }).notNull().default("0"),
  total_withholding_etb: decimal("total_withholding_etb", { precision: 16, scale: 2 }).notNull().default("0"),
  generated_by_id: uuid("generated_by_id").references(() => users.id),
  generated_at: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("daily_summaries_date_branch_idx").on(table.summary_date, table.branch_id),
]);

// ============================================================
// 19. USER SESSIONS
// ============================================================

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  token_hash: varchar("token_hash", { length: 255 }).unique().notNull(),
  ip_address: varchar("ip_address", { length: 45 }),
  user_agent: text("user_agent"),
  device_info: varchar("device_info", { length: 200 }),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  last_active_at: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

// ============================================================
// 20. PASSWORD HISTORY
// ============================================================

export const passwordHistory = pgTable("password_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 21. SYSTEM CONFIGS
// ============================================================

export const systemConfigs = pgTable("system_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  config_key: varchar("config_key", { length: 100 }).unique().notNull(),
  config_value: text("config_value").notNull(),
  value_type: varchar("value_type", { length: 10 }).notNull().default("STRING"),
  description: text("description"),
  is_public: boolean("is_public").notNull().default(false),
  ...timestamps,
});

// ============================================================
// 22. NOTIFICATION TEMPLATES
// ============================================================

export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  template_key: varchar("template_key", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  channel: varchar("channel", { length: 10 }).notNull(),
  subject_template: text("subject_template"),
  body_template: text("body_template").notNull(),
  is_active: boolean("is_active").notNull().default(true),
  ...timestamps,
});

// ============================================================
// 23. NOTIFICATIONS
// ============================================================

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  template_id: uuid("template_id").references(() => notificationTemplates.id),
  type: varchar("type", { length: 10 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  metadata: jsonb("metadata"),
  sent_at: timestamp("sent_at", { withTimezone: true }),
  read_at: timestamp("read_at", { withTimezone: true }),
  retry_count: integer("retry_count").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

// ============================================================
// 24. AUDIT LOGS (append-only)
// ============================================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(),
  entity_name: varchar("entity_name", { length: 100 }).notNull(),
  entity_id: uuid("entity_id"),
  old_values: jsonb("old_values"),
  new_values: jsonb("new_values"),
  ip_address: varchar("ip_address", { length: 45 }),
  user_agent: text("user_agent"),
  request_id: varchar("request_id", { length: 100 }),
  session_id: uuid("session_id"),
  duration_ms: integer("duration_ms"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_user_idx").on(table.user_id),
  index("audit_logs_entity_idx").on(table.entity_name, table.entity_id),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_timestamp_idx").on(table.timestamp),
  index("audit_logs_request_idx").on(table.request_id),
]);
