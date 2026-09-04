import type { UserRole } from "@customs-duty-pro/shared";
import { USER_ROLES } from "@customs-duty-pro/shared";

export type Permission =
  | "hs_code:view"
  | "hs_code:create"
  | "hs_code:edit"
  | "hs_code:delete"
  | "forex:view"
  | "forex:set"
  | "assessment:create"
  | "assessment:submit"
  | "assessment:view_own"
  | "assessment:view_branch"
  | "assessment:view_all"
  | "assessment:approve_reject"
  | "assessment:cancel"
  | "assessment:mark_paid"
  | "assessment:download_pdf"
  | "notification:view"
  | "user:view_all"
  | "user:create"
  | "user:suspend_activate"
  | "user:change_role"
  | "audit:view"
  | "override:manage";

/**
 * Permission matrix (spec 5.2). Each role lists the permissions it is granted.
 */
export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  IMPORTER: new Set<Permission>([
    "hs_code:view",
    "forex:view",
    "assessment:create",
    "assessment:submit",
    "assessment:view_own",
    "assessment:cancel",
    "assessment:download_pdf",
    "notification:view",
  ]),
  VALUATION_OFFICER: new Set<Permission>([
    "hs_code:view",
    "forex:view",
    "assessment:create",
    "assessment:submit",
    "assessment:view_branch",
    "assessment:approve_reject",
    "assessment:cancel",
    "assessment:mark_paid",
    "assessment:download_pdf",
    "notification:view",
  ]),
  TARIFF_SPECIALIST: new Set<Permission>([
    "hs_code:view",
    "hs_code:create",
    "hs_code:edit",
    "forex:view",
    "forex:set",
    "assessment:view_all",
    "assessment:download_pdf",
    "notification:view",
    "override:manage",
  ]),
  SUPER_ADMIN: new Set<Permission>([
    "hs_code:view",
    "hs_code:create",
    "hs_code:edit",
    "hs_code:delete",
    "forex:view",
    "forex:set",
    "assessment:view_all",
    "assessment:approve_reject",
    "assessment:cancel",
    "assessment:mark_paid",
    "assessment:download_pdf",
    "notification:view",
    "user:view_all",
    "user:create",
    "user:suspend_activate",
    "user:change_role",
    "audit:view",
    "override:manage",
  ]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  // Defensive: treat an unknown role as having no permissions.
  if (!allowed) return false;
  return allowed.has(permission);
}

export function isValidRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
