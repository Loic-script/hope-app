import { env, type LogLevel } from '../config/env.js';

/**
 * Logger minimaliste. Volontairement sans dependance externe : il pourra etre
 * remplace par pino/winston plus tard sans toucher aux services.
 */

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function shouldLog(level: Exclude<LogLevel, 'silent'>): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[env.logLevel];
}

function write(
  level: Exclude<LogLevel, 'silent'>,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  if (context && Object.keys(context).length > 0) {
    console.log(`${prefix} ${message}`, context);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
