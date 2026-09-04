export const USER_ROLES = ["IMPORTER", "VALUATION_OFFICER", "TARIFF_SPECIALIST", "SUPER_ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "LOCKED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ASSESSMENT_STATUSES = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED",
  "PAID", "PARTIALLY_PAID", "EXPIRED", "CANCELLED", "APPEALED",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const EXEMPTION_TYPES = ["NONE", "DIASPORA", "INVESTMENT", "DIPLOMATIC"] as const;
export type ExemptionType = (typeof EXEMPTION_TYPES)[number];

export const NOTIFICATION_TYPES = ["EMAIL", "SMS", "IN_APP"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DOCUMENT_TYPES = [
  "EXEMPTION_CERTIFICATE", "EIC_APPROVAL", "COMMERCIAL_INVOICE",
  "PACKING_LIST", "BILL_OF_LADING", "AIRWAY_BILL", "CERTIFICATE_OF_ORIGIN",
  "INSURANCE_CERTIFICATE", "IMPORT_PERMIT", "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PAYMENT_STATUSES = ["PENDING", "CONFIRMED", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "MOBILE_MONEY", "CHEQUE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const APPEAL_STATUSES = ["FILED", "UNDER_REVIEW", "UPHELD", "OVERTURNED", "DISMISSED"] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const PORT_TYPES = ["AIRPORT", "SEAPORT", "DRY_PORT", "LAND_BORDER"] as const;
export type PortType = (typeof PORT_TYPES)[number];

export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "CNY", "CAD", "INR", "SAR", "TRY", "JPY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_TAX_RATES = {
  VAT: 0.15,
  SURTAX: 0.10,
  WITHHOLDING: 0.03,
  SCANNING_FEE_ETB: 200,
} as const;

export const BRANCH_CODES = {
  ADD: "Bole International Airport",
  ADP: "Passenger Terminal",
  KAL: "Kality Dry Port",
  DRM: "Dire Dawa Customs Branch",
  BDR: "Bahir Dar Customs Branch",
  MKL: "Mekelle Customs Branch",
  JIM: "Jimma Customs Branch",
  ASM: "Assab Corridor Office",
} as const;
