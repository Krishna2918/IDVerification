import { ERROR_CODES, ERROR_MESSAGES, ErrorCode } from '../constants/error-codes';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message || ERROR_MESSAGES[code] || 'An error occurred');
    this.code = code;
    this.statusCode = statusCode || getHttpStatusForError(code);
    this.details = details;
    this.name = 'AppError';

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

function getHttpStatusForError(code: ErrorCode): number {
  // 4xx Client Errors
  if (code.startsWith('E1') || code.startsWith('E6')) return 404; // Not found errors
  if (code.startsWith('E7')) return code === ERROR_CODES.FORBIDDEN ? 403 : 401;
  if (code.startsWith('E8')) return 400; // Validation errors
  if (code === ERROR_CODES.MAX_ATTEMPTS_EXCEEDED) return 429;
  if (code === ERROR_CODES.RATE_LIMIT_EXCEEDED) return 429;

  // 5xx Server Errors
  if (code.startsWith('E9')) return code === ERROR_CODES.SERVICE_UNAVAILABLE ? 503 : 500;
  if (code.startsWith('E5')) return 500; // Processing errors

  // Default
  return 400;
}

export function createErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(error.toJSON()),
    };
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
      },
    }),
  };
}

export function createSuccessResponse<T>(data: T, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(data),
  };
}
