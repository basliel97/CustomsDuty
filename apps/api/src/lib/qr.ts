import jwt from "jsonwebtoken";
import { config } from "./config.js";

/**
 * Signed QR verification payload. Signing with the dedicated QR_SIGNING_KEY
 * keeps QR verification isolated from auth tokens and lets gate officers scan
 * a compact, tamper-evident token.
 */
export interface QrPayload {
  assessmentId: string;
  assessmentNumber: string;
  status: string;
  totalPayable: number;
  issuedAt: number;
  expiresAt: number;
}

const QR_TOKEN_EXPIRY = "365d";

export function signQrToken(payload: QrPayload): string {
  return jwt.sign(
    {
      assessmentId: payload.assessmentId,
      assessmentNumber: payload.assessmentNumber,
      status: payload.status,
      totalPayable: payload.totalPayable,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    },
    config.QR_SIGNING_KEY,
    { algorithm: "HS256", expiresIn: QR_TOKEN_EXPIRY }
  );
}

export function verifyQrToken(token: string): QrPayload | null {
  try {
    const decoded = jwt.verify(token, config.QR_SIGNING_KEY, {
      algorithms: ["HS256"],
      ignoreExpiration: true,
    }) as Partial<QrPayload> & Record<string, unknown>;
    if (
      !decoded.assessmentId ||
      !decoded.assessmentNumber ||
      typeof decoded.totalPayable !== "number" ||
      typeof decoded.expiresAt !== "number"
    ) {
      return null;
    }
    return {
      assessmentId: String(decoded.assessmentId),
      assessmentNumber: String(decoded.assessmentNumber),
      status: typeof decoded.status === "string" ? decoded.status : "",
      totalPayable: decoded.totalPayable,
      issuedAt: typeof decoded.issuedAt === "number" ? decoded.issuedAt : 0,
      expiresAt: decoded.expiresAt,
    };
  } catch {
    return null;
  }
}
