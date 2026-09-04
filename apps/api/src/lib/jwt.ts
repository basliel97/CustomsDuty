import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";
import type { UserRole } from "@customs-duty-pro/shared";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  branchLocation?: string | null;
}

export interface AccessTokenClaims extends AccessTokenPayload {
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Sign an access token (JWT, HS256) with the configured secret & expiry.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: config.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Verify an access token. Returns the decoded claims or null if invalid/expired.
 */
export function verifyAccessToken(token: string): AccessTokenClaims | null {
  try {
    return jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ["HS256"] }) as AccessTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically random refresh token (256-bit base64url).
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hash a refresh token (SHA-256) for storage. Tokens are never stored in plaintext.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a full token pair (access + refresh).
 */
export function createTokenPair(payload: AccessTokenPayload): TokenPair {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: generateRefreshToken(),
  };
}

export interface EmailVerificationClaims {
  sub: string;
  email: string;
}

/**
 * Sign an email-verification token (long-lived, HS256) for magic-link style
 * account activation.
 */
export function signEmailVerificationToken(claims: EmailVerificationClaims): string {
  return jwt.sign(claims, config.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: "24h",
  });
}

/**
 * Verify an email-verification token. Returns the claims or null.
 */
export function verifyEmailVerificationToken(token: string): EmailVerificationClaims | null {
  try {
    return jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
    }) as EmailVerificationClaims;
  } catch {
    return null;
  }
}
