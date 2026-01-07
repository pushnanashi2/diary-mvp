/**
 * Validators Unit Tests
 * バリデーター関数のユニットテスト
 */

import {
  validateULID,
  validateEmail,
  validateDate,
  validateEnum,
  validateRequired,
  validateLength
} from '../../utils/validators.js';
import { ApiError } from '../../middleware/errorHandler.js';

describe('Validators', () => {
  describe('validateULID', () => {
    test('有効なULIDを受け入れる', () => {
      const validULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      expect(() => validateULID(validULID)).not.toThrow();
      expect(validateULID(validULID)).toBe(validULID);
    });

    test('無効なULIDを拒否する', () => {
      expect(() => validateULID('invalid')).toThrow(ApiError);
      expect(() => validateULID('')).toThrow(ApiError);
      expect(() => validateULID(null)).toThrow(ApiError);
    });
  });

  describe('validateEmail', () => {
    test('有効なメールアドレスを受け入れる', () => {
      const validEmail = 'test@example.com';
      expect(() => validateEmail(validEmail)).not.toThrow();
      expect(validateEmail(validEmail)).toBe(validEmail);
    });

    test('メールアドレスを小文字に変換する', () => {
      expect(validateEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    test('無効なメールアドレスを拒否する', () => {
      expect(() => validateEmail('invalid')).toThrow(ApiError);
      expect(() => validateEmail('test@')).toThrow(ApiError);
      expect(() => validateEmail('@example.com')).toThrow(ApiError);
    });
  });

  describe('validateDate', () => {
    test('有効な日付形式を受け入れる', () => {
      const validDate = '2026-01-07';
      expect(() => validateDate(validDate)).not.toThrow();
      expect(validateDate(validDate)).toBe(validDate);
    });

    test('無効な日付形式を拒否する', () => {
      expect(() => validateDate('2026/01/07')).toThrow(ApiError);
      expect(() => validateDate('01-07-2026')).toThrow(ApiError);
      expect(() => validateDate('invalid')).toThrow(ApiError);
    });

    test('実在しない日付を拒否する', () => {
      expect(() => validateDate('2026-13-01')).toThrow(ApiError);
      expect(() => validateDate('2026-02-30')).toThrow(ApiError);
    });
  });

  describe('validateEnum', () => {
    test('許可された値を受け入れる', () => {
      const allowedValues = ['pending', 'processing', 'done'];
      expect(() => validateEnum('pending', allowedValues)).not.toThrow();
      expect(validateEnum('done', allowedValues)).toBe('done');
    });

    test('許可されていない値を拒否する', () => {
      const allowedValues = ['pending', 'processing', 'done'];
      expect(() => validateEnum('invalid', allowedValues)).toThrow(ApiError);
    });
  });

  describe('validateRequired', () => {
    test('値が存在する場合は受け入れる', () => {
      expect(() => validateRequired('value')).not.toThrow();
      expect(validateRequired(123)).toBe(123);
      expect(validateRequired(false)).toBe(false);
    });

    test('値が存在しない場合は拒否する', () => {
      expect(() => validateRequired(null)).toThrow(ApiError);
      expect(() => validateRequired(undefined)).toThrow(ApiError);
      expect(() => validateRequired('')).toThrow(ApiError);
    });
  });

  describe('validateLength', () => {
    test('長さが範囲内の文字列を受け入れる', () => {
      expect(() => validateLength('test', 1, 10)).not.toThrow();
      expect(validateLength('hello', 5, 5)).toBe('hello');
    });

    test('長さが範囲外の文字列を拒否する', () => {
      expect(() => validateLength('a', 2, 10)).toThrow(ApiError);
      expect(() => validateLength('very long string', 1, 5)).toThrow(ApiError);
    });
  });
});
