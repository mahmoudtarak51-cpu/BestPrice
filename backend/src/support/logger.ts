import type { FastifyBaseLogger } from 'fastify';
import pino, { type Logger } from 'pino';

export type AppLogger = FastifyBaseLogger;

export function createLogger(
  service: string,
  level: pino.LevelWithSilent = 'info',
): AppLogger {
  return pino({
    name: service,
    level,
    base: undefined,
    redact: {
      paths: [
        'password',
        'passwordHash',
        'sessionSecret',
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ],
      censor: '[redacted]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  });
}

export function withBindings(
  logger: AppLogger,
  bindings: Record<string, string | number | boolean | undefined>,
): AppLogger {
  return (logger as Logger).child(bindings);
}
