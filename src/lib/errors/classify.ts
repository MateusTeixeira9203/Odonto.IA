/**
 * Error classification and observability.
 *
 * Builds on the AppError hierarchy in src/server/errors/app-error.ts.
 * Adds cross-cutting concerns: severity, retryability, normalized shape.
 *
 * ── Why this matters ─────────────────────────────────────────────────────────
 *
 * At scale, errors split into two buckets:
 *   Operational: expected failures (validation, 404, permission denied) — alert.
 *   Fatal:       unexpected failures (DB crash, memory, unhandled throw) — page.
 *
 * Retryable vs Non-retryable separates transient from permanent failures.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   catch (err) {
 *     const classified = classifyError(err);
 *     if (classified.fatal) {
 *       console.error('[FATAL]', classified.requestId, classified.message);
 *     }
 *     return fail(classified.userMessage);
 *   }
 */

import { AppError } from '@/server/errors/app-error';
import type { ErrorCode } from '@/server/errors/error-codes';

export type ErrorSeverity = 'operational' | 'fatal';

export type ClassifiedError = {
  /** Original error code, if any */
  code:        ErrorCode | 'UNKNOWN_ERROR';
  /** Human-readable message safe for internal logging */
  message:     string;
  /** User-facing message — never expose raw DB or stack trace */
  userMessage: string;
  /** operational = expected failure; fatal = needs immediate attention */
  severity:    ErrorSeverity;
  /** true if the operation can safely be retried (transient failures) */
  retryable:   boolean;
  /** HTTP-equivalent status hint */
  statusHint:  number;
};

/** Error codes classified as operational (expected, not alertable) */
const OPERATIONAL_CODES = new Set<ErrorCode>([
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FIRST_ACCESS_REQUIRED',
  'INSUFFICIENT_PERMISSION',
  'INVALID_INVITE',
  'INVITE_EXPIRED',
  'INVITE_ALREADY_ACCEPTED',
  'INVITE_LIMIT_REACHED',
  'SELF_REMOVAL_BLOCKED',
  'LAST_ADMIN_BLOCKED',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_WEBHOOK_SIGNATURE',
  'INVALID_FINANCE_SCOPE',
]);

/** Error codes where retrying the operation is safe */
const RETRYABLE_CODES = new Set<ErrorCode>([
  'AI_PROVIDER_UNAVAILABLE',
  'EXTERNAL_SERVICE_ERROR',
  'DATABASE_ERROR',
]);

/** Friendly messages shown to users for each code category */
const USER_MESSAGES: Partial<Record<ErrorCode | 'UNKNOWN_ERROR', string>> = {
  UNAUTHENTICATED:          'Sessão expirada. Por favor, faça login novamente.',
  SESSION_EXPIRED:          'Sessão expirada. Por favor, faça login novamente.',
  INSUFFICIENT_PERMISSION:  'Você não tem permissão para esta ação.',
  NOT_FOUND:                'Registro não encontrado.',
  CONFLICT:                 'Esta operação conflita com dados existentes.',
  AI_PROVIDER_UNAVAILABLE:  'Serviço de IA temporariamente indisponível. Tente novamente.',
  EXTERNAL_SERVICE_ERROR:   'Serviço externo indisponível. Tente novamente em alguns instantes.',
  DATABASE_ERROR:           'Erro ao processar a operação. Tente novamente.',
  UNKNOWN_ERROR:            'Ocorreu um erro inesperado. Nossa equipe foi notificada.',
};

/**
 * Normalize any thrown value to a ClassifiedError.
 * Works with AppError (typed), generic Error, strings, and unknown throws.
 */
export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof AppError) {
    const code     = err.code;
    const severity = OPERATIONAL_CODES.has(code) ? 'operational' : 'fatal';
    return {
      code,
      message:     err.message,
      userMessage: USER_MESSAGES[code] ?? err.message,
      severity,
      retryable:   RETRYABLE_CODES.has(code),
      statusHint:  err.statusHint,
    };
  }

  if (err instanceof Error) {
    // Supabase PGRST / DB errors often embed clues in the message
    const isDb        = /pgrst|postgres|duplicate key|foreign key/i.test(err.message);
    const isNetwork   = /fetch|network|ECONNREFUSED|timeout/i.test(err.message);
    const retryable   = isDb || isNetwork;
    const code: ErrorCode = isDb ? 'DATABASE_ERROR' : isNetwork ? 'EXTERNAL_SERVICE_ERROR' : 'UNKNOWN_ERROR';

    return {
      code,
      message:     err.message,
      userMessage: USER_MESSAGES[code] ?? USER_MESSAGES.UNKNOWN_ERROR!,
      severity:    retryable ? 'operational' : 'fatal',
      retryable,
      statusHint:  isNetwork ? 502 : 500,
    };
  }

  return {
    code:        'UNKNOWN_ERROR',
    message:     String(err),
    userMessage: USER_MESSAGES.UNKNOWN_ERROR!,
    severity:    'fatal',
    retryable:   false,
    statusHint:  500,
  };
}

/**
 * Normalize any thrown value to a plain user-facing message string.
 * Use in server actions when full classification isn't needed.
 */
export function normalizeError(err: unknown): string {
  return classifyError(err).userMessage;
}

/**
 * Returns true if the error is safe to retry automatically.
 * Use with withRetry() to avoid retrying permanent failures.
 *
 * Usage:
 *   await withRetry(() => callExternalApi(), {
 *     maxAttempts: isRetryable(err) ? 3 : 1,
 *   });
 */
export function isRetryable(err: unknown): boolean {
  return classifyError(err).retryable;
}

/**
 * Log an error with appropriate severity prefix.
 * Keeps error reporting consistent across server actions and API routes.
 */
export function logError(context: string, err: unknown): ClassifiedError {
  const classified = classifyError(err);
  const prefix = classified.severity === 'fatal' ? '[FATAL]' : '[WARN]';
  console.error(`${prefix} [${context}] ${classified.code}: ${classified.message}`);
  return classified;
}
