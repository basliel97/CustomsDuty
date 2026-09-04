import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password with bcrypt (12 rounds).
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 */
export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const PASSWORD_POLICY = {
  minLength: 8,
  requiresUppercase: true,
  requiresLowercase: true,
  requiresNumber: true,
  requiresSpecial: true,
} as const;

/**
 * Validate a password against the enforced policy.
 * Returns a list of human-readable violations (empty if valid).
 */
export function validatePassword(password: string): string[] {
  const violations: string[] = [];
  if (typeof password !== "string" || password.length < PASSWORD_POLICY.minLength) {
    violations.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (PASSWORD_POLICY.requiresUppercase && !/[A-Z]/.test(password)) {
    violations.push("Password must contain at least one uppercase letter");
  }
  if (PASSWORD_POLICY.requiresLowercase && !/[a-z]/.test(password)) {
    violations.push("Password must contain at least one lowercase letter");
  }
  if (PASSWORD_POLICY.requiresNumber && !/[0-9]/.test(password)) {
    violations.push("Password must contain at least one number");
  }
  if (PASSWORD_POLICY.requiresSpecial && !/[^A-Za-z0-9]/.test(password)) {
    violations.push("Password must contain at least one special character");
  }
  return violations;
}
