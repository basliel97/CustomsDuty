import type { ErrorHandler } from "hono";
import { AppError } from "../lib/errors.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get("requestId") as string | undefined;

  if (err instanceof AppError) {
    logger.warn(err.message, {
      statusCode: err.statusCode,
      code: err.code,
      requestId,
    });

    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.statusCode as any
    );
  }

  // Unexpected errors
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    requestId,
  });

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          config.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
      },
    },
    500
  );
};
