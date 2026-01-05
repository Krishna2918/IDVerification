import { AppError } from './error-handler';
import { ERROR_CODES } from '../constants/error-codes';

/**
 * Validates that a value is not null or undefined
 */
export function required<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      `${fieldName} is required`,
      400,
      { field: fieldName }
    );
  }
  return value;
}

/**
 * Validates a UUID v4 format
 */
export function validateUUID(value: string, fieldName: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} must be a valid UUID`,
      400,
      { field: fieldName, value }
    );
  }
  return value;
}

/**
 * Validates an email address
 */
export function validateEmail(value: string, fieldName: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} must be a valid email address`,
      400,
      { field: fieldName }
    );
  }
  return value;
}

/**
 * Validates that a value is one of the allowed values
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string
): T {
  if (!allowedValues.includes(value as T)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      400,
      { field: fieldName, value, allowedValues }
    );
  }
  return value as T;
}

/**
 * Validates a date string (ISO 8601)
 */
export function validateDateString(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} must be a valid date`,
      400,
      { field: fieldName, value }
    );
  }
  return date;
}

/**
 * Validates a URL
 */
export function validateUrl(value: string, fieldName: string): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} must be a valid URL`,
      400,
      { field: fieldName }
    );
  }
}

/**
 * Validates string length
 */
export function validateLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): string {
  if (value.length < min || value.length > max) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} must be between ${min} and ${max} characters`,
      400,
      { field: fieldName, length: value.length, min, max }
    );
  }
  return value;
}

/**
 * Validates content type for document uploads
 */
export function validateContentType(contentType: string): string {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(contentType)) {
    throw new AppError(
      ERROR_CODES.DOCUMENT_INVALID_FORMAT,
      `Content type must be one of: ${allowedTypes.join(', ')}`,
      400,
      { contentType, allowedTypes }
    );
  }
  return contentType;
}

/**
 * Checks if a date of birth indicates the person is over 18
 */
export function isOver18(dateOfBirth: Date): boolean {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 18;
}

/**
 * Checks if a document expiry date is in the future
 */
export function isDocumentValid(expiryDate: Date): boolean {
  return expiryDate > new Date();
}
