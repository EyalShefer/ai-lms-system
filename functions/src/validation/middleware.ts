/**
 * Validation Middleware for Cloud Functions
 *
 * Provides request validation for onCall and onRequest handlers.
 * Uses Zod schemas for runtime type checking.
 */

import { z } from 'zod';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

// ============================================================
// TYPES
// ============================================================

export interface ValidationOptions {
  /** Log validation errors */
  logErrors?: boolean;
  /** Include detailed error info in response (disable in prod) */
  detailedErrors?: boolean;
  /** Custom error message */
  errorMessage?: string;
}

// ============================================================
// CALLABLE FUNCTION VALIDATION
// ============================================================

/**
 * Validate request data for onCall functions
 *
 * @example
 * export const myFunction = onCall(async (request) => {
 *   const data = validateCallableRequest(
 *     request,
 *     MyRequestSchema,
 *     { logErrors: true }
 *   );
 *   // data is now typed and validated
 * });
 */
export function validateCallableRequest<T>(
  request: CallableRequest<unknown>,
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): T {
  const { logErrors = true, detailedErrors = false, errorMessage } = options;

  const result = schema.safeParse(request.data);

  if (!result.success) {
    const error = result.error;

    if (logErrors) {
      logger.warn('Request validation failed', {
        userId: request.auth?.uid,
        errors: error.issues,
        receivedData: sanitizeForLogging(request.data)
      });
    }

    // Build error message
    const issues = error.issues.map(e =>
      `${e.path.join('.')}: ${e.message}`
    ).join('; ');

    const message = errorMessage ||
      (detailedErrors
        ? `Invalid request: ${issues}`
        : 'Invalid request data');

    throw new HttpsError('invalid-argument', message);
  }

  return result.data;
}

/**
 * Create a validated onCall handler
 *
 * @example
 * export const myFunction = onCall(
 *   { cors: true },
 *   withValidation(MyRequestSchema, async (data, request) => {
 *     // data is validated and typed
 *     return { success: true };
 *   })
 * );
 */
export function withValidation<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (data: TInput, request: CallableRequest<unknown>) => Promise<TOutput>,
  options: ValidationOptions = {}
): (request: CallableRequest<unknown>) => Promise<TOutput> {
  return async (request: CallableRequest<unknown>) => {
    const validatedData = validateCallableRequest(request, schema, options);
    return handler(validatedData, request);
  };
}

// ============================================================
// EXPRESS/HTTP VALIDATION
// ============================================================

import type { Request, Response, NextFunction } from 'express';

/**
 * Express middleware for request body validation
 *
 * @example
 * app.post('/api/generate',
 *   validateBody(GenerateRequestSchema),
 *   async (req, res) => {
 *     // req.body is validated
 *   }
 * );
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const { logErrors = true, detailedErrors = false, errorMessage } = options;

    const result = schema.safeParse(req.body);

    if (!result.success) {
      if (logErrors) {
        logger.warn('Body validation failed', {
          path: req.path,
          errors: result.error.issues,
          body: sanitizeForLogging(req.body)
        });
      }

      const issues = result.error.issues.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join('; ');

      res.status(400).json({
        error: 'Validation Error',
        message: errorMessage || (detailedErrors ? issues : 'Invalid request body'),
        ...(detailedErrors && { details: result.error.issues })
      });
      return;
    }

    // Attach validated data
    (req as any).validatedBody = result.data;
    next();
  };
}

/**
 * Express middleware for query parameter validation
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      if (options.logErrors !== false) {
        logger.warn('Query validation failed', {
          path: req.path,
          errors: result.error.issues
        });
      }

      res.status(400).json({
        error: 'Validation Error',
        message: options.errorMessage || 'Invalid query parameters'
      });
      return;
    }

    (req as any).validatedQuery = result.data;
    next();
  };
}

// ============================================================
// LLM OUTPUT VALIDATION
// ============================================================

/**
 * Validate and parse LLM JSON output
 * Includes repair attempts for common issues
 */
export function validateLLMResponse<T>(
  rawOutput: string,
  schema: z.ZodSchema<T>,
  context?: string
): { success: true; data: T } | { success: false; error: string; raw: string } {
  try {
    // Clean markdown code blocks
    let cleaned = rawOutput
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Extract JSON if wrapped in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Attempt repairs
      cleaned = repairJSON(cleaned);
      parsed = JSON.parse(cleaned);
    }

    // Validate
    const result = schema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data };
    }

    logger.warn('LLM output validation failed', {
      context,
      errors: result.error.issues,
      parsed: sanitizeForLogging(parsed)
    });

    return {
      success: false,
      error: `Schema validation failed: ${result.error.issues.map(e => e.message).join(', ')}`,
      raw: rawOutput.substring(0, 500)
    };

  } catch (parseError) {
    logger.error('LLM output parse failed', {
      context,
      error: String(parseError),
      raw: rawOutput.substring(0, 200)
    });

    return {
      success: false,
      error: `JSON parse failed: ${String(parseError)}`,
      raw: rawOutput.substring(0, 500)
    };
  }
}

/**
 * Attempt to repair common JSON issues from LLMs
 */
function repairJSON(json: string): string {
  return json
    // Remove trailing commas
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    // Fix single quotes (common in some LLMs)
    .replace(/'/g, '"')
    // Fix unquoted keys
    .replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Fix escaped newlines in strings
    .replace(/\\n/g, '\\\\n');
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Sanitize data for logging (remove sensitive/large fields)
 */
function sanitizeForLogging(data: unknown, maxLength = 500): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data.length > maxLength ? data.substring(0, maxLength) + '...' : data;
  }

  if (Array.isArray(data)) {
    return data.length > 10
      ? [...data.slice(0, 10).map(item => sanitizeForLogging(item, maxLength)), '...']
      : data.map(item => sanitizeForLogging(item, maxLength));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'key'];

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForLogging(value, maxLength);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Create Zod error summary for user-facing messages
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map(e => {
    const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
    return `${path}${e.message}`;
  }).join('; ');
}
