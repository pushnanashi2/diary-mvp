/**
 * Input Validators
 * 共通バリデーションロジックの集約
 */

import { ApiError } from '../middleware/errorHandler.js';

/**
 * ULIDフォーマットの検証
 */
export function validateULID(value, fieldName = 'id') {
  const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  if (!value || !ulidRegex.test(value)) {
    throw new ApiError('INVALID_ULID', `Invalid ${fieldName} format`, 400);
  }
  return value;
}

/**
 * メールアドレスの検証
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new ApiError('INVALID_EMAIL', 'Invalid email format', 400);
  }
  return email.toLowerCase();
}

/**
 * 日付形式の検証 (YYYY-MM-DD)
 */
export function validateDate(dateString, fieldName = 'date') {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString || !dateRegex.test(dateString)) {
    throw new ApiError('INVALID_DATE', `Invalid ${fieldName} format (expected YYYY-MM-DD)`, 400);
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new ApiError('INVALID_DATE', `Invalid ${fieldName} value`, 400);
  }
  
  return dateString;
}

/**
 * 列挙値の検証
 */
export function validateEnum(value, allowedValues, fieldName = 'value') {
  if (!allowedValues.includes(value)) {
    throw new ApiError(
      'INVALID_ENUM',
      `Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`,
      400
    );
  }
  return value;
}

/**
 * 数値範囲の検証
 */
export function validateRange(value, min, max, fieldName = 'value') {
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new ApiError(
      'INVALID_RANGE',
      `${fieldName} must be between ${min} and ${max}`,
      400
    );
  }
  return num;
}

/**
 * 必須フィールドの検証
 */
export function validateRequired(value, fieldName = 'field') {
  if (value === null || value === undefined || value === '') {
    throw new ApiError('MISSING_FIELD', `${fieldName} is required`, 400);
  }
  return value;
}

/**
 * 文字列長の検証
 */
export function validateLength(str, min, max, fieldName = 'field') {
  if (!str || str.length < min || str.length > max) {
    throw new ApiError(
      'INVALID_LENGTH',
      `${fieldName} must be between ${min} and ${max} characters`,
      400
    );
  }
  return str;
}
