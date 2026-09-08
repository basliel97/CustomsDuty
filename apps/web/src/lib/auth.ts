export const ROLES = {
  IMPORTER: "IMPORTER",
  VALUATION_OFFICER: "VALUATION_OFFICER",
  TARIFF_SPECIALIST: "TARIFF_SPECIALIST",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  IMPORTER: "Importer",
  VALUATION_OFFICER: "Valuation Officer",
  TARIFF_SPECIALIST: "Tariff Specialist",
  SUPER_ADMIN: "System Administrator",
};

export const NAV_PERMISSIONS: Record<
  string,
  {
    dashboard: string;
    assessments: string;
    notifications: boolean;
    hsCodes: boolean;
    forex: boolean;
    users: boolean;
    audit: boolean;
    reports: boolean;
  }
> = {
  IMPORTER: {
    dashboard: "/dashboard",
    assessments: "/assessments",
    notifications: true,
    hsCodes: false,
    forex: false,
    users: false,
    audit: false,
    reports: false,
  },
  VALUATION_OFFICER: {
    dashboard: "/dashboard",
    assessments: "/assessments",
    notifications: true,
    hsCodes: false,
    forex: false,
    users: false,
    audit: false,
    reports: false,
  },
  TARIFF_SPECIALIST: {
    dashboard: "/dashboard",
    assessments: "/assessments",
    notifications: true,
    hsCodes: true,
    forex: true,
    users: false,
    audit: false,
    reports: true,
  },
  SUPER_ADMIN: {
    dashboard: "/dashboard",
    assessments: "/assessments",
    notifications: true,
    hsCodes: true,
    forex: true,
    users: true,
    audit: true,
    reports: true,
  },
};