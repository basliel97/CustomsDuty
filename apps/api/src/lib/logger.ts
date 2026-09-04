type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function createLogger(level: LogLevel = "info") {
  const currentLevel = LOG_LEVELS[level];

  function log(lvl: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[lvl] < currentLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      message,
      ...meta,
    };

    const output = JSON.stringify(entry);

    if (lvl === "error") {
      console.error(output);
    } else if (lvl === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  return {
    debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  };
}

export const logger = createLogger(process.env.LOG_LEVEL as LogLevel | undefined);
