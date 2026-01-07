/**
 * Request Validation Middleware
 * リクエストバリデーションの統一化
 */

import { ApiError } from './errorHandler.js';
import {
  validateULID,
  validateEmail,
  validateDate,
  validateEnum,
  validateRequired,
  validateLength
} from '../utils/validators.js';

/**
 * ボディバリデーション
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const errors = [];

      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];

        // 必須チェック
        if (rules.required && !value) {
          errors.push(`${field} is required`);
          continue;
        }

        // 値が存在する場合のみバリデーション
        if (value !== null && value !== undefined && value !== '') {
          // 型チェック
          if (rules.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rules.type) {
              errors.push(`${field} must be of type ${rules.type}`);
              continue;
            }
          }

          // 列挙値チェック
          if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
          }

          // 長さチェック
          if (rules.minLength && value.length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters`);
          }
          if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`${field} must be at most ${rules.maxLength} characters`);
          }

          // 範囲チェック
          if (rules.min !== undefined && value < rules.min) {
            errors.push(`${field} must be at least ${rules.min}`);
          }
          if (rules.max !== undefined && value > rules.max) {
            errors.push(`${field} must be at most ${rules.max}`);
          }

          // カスタムバリデーター
          if (rules.validator) {
            const result = rules.validator(value);
            if (result !== true) {
              errors.push(result || `${field} is invalid`);
            }
          }
        }
      }

      if (errors.length > 0) {
        throw new ApiError('VALIDATION_ERROR', 'Validation failed', 400, errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * パラメータバリデーション
 */
export function validateParams(schema) {
  return (req, res, next) => {
    try {
      for (const [param, validator] of Object.entries(schema)) {
        const value = req.params[param];
        
        if (!value) {
          throw new ApiError('MISSING_PARAM', `Missing parameter: ${param}`, 400);
        }

        if (typeof validator === 'function') {
          validator(value, param);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * クエリバリデーション
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      for (const [key, rules] of Object.entries(schema)) {
        const value = req.query[key];

        if (rules.required && !value) {
          throw new ApiError('MISSING_QUERY', `Missing query parameter: ${key}`, 400);
        }

        if (value && rules.enum && !rules.enum.includes(value)) {
          throw new ApiError(
            'INVALID_QUERY',
            `Invalid ${key}. Allowed values: ${rules.enum.join(', ')}`,
            400
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
