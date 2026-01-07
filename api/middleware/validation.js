/**
 * バリデーションミドルウェア
 * リクエストデータの検証を統一的に処理
 */
import { ApiError } from './errorHandler.js';

/**
 * メールアドレス検証
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * パスワード検証
 */
export function validatePassword(password) {
  return password && password.length >= 8;
}

/**
 * テンプレートID検証
 */
export function validateTemplateId(templateId) {
  const validTemplates = ['default', 'bullet', 'emotion'];
  return validTemplates.includes(templateId);
}

/**
 * 日付文字列検証（YYYY-MM-DD）
 */
export function validateDateString(dateStr) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * 正の整数検証
 */
export function parsePositiveInt(value, defaultValue, max = null) {
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  
  if (max !== null && parsed > max) {
    return max;
  }
  
  return parsed;
}

/**
 * ユーザー登録バリデーション
 */
export function validateRegistration(req, res, next) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    throw new ApiError(400, 'MISSING_FIELDS', 'Email and password are required');
  }
  
  if (!validateEmail(email)) {
    throw new ApiError(400, 'INVALID_EMAIL', 'Invalid email format');
  }
  
  if (!validatePassword(password)) {
    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
  }
  
  next();
}

/**
 * ログインバリデーション
 */
export function validateLogin(req, res, next) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    throw new ApiError(400, 'MISSING_FIELDS', 'Email and password are required');
  }
  
  next();
}

/**
 * 期間要約作成バリデーション
 */
export function validateSummaryCreation(req, res, next) {
  const { range_start, range_end, template_id } = req.body;
  
  if (!range_start || !range_end) {
    throw new ApiError(400, 'MISSING_FIELDS', 'range_start and range_end are required');
  }
  
  if (!validateDateString(range_start)) {
    throw new ApiError(400, 'INVALID_DATE', 'range_start must be in YYYY-MM-DD format');
  }
  
  if (!validateDateString(range_end)) {
    throw new ApiError(400, 'INVALID_DATE', 'range_end must be in YYYY-MM-DD format');
  }
  
  if (new Date(range_start) > new Date(range_end)) {
    throw new ApiError(400, 'INVALID_RANGE', 'range_start must be before range_end');
  }
  
  if (template_id && !validateTemplateId(template_id)) {
    throw new ApiError(400, 'INVALID_TEMPLATE', 'Invalid template_id');
  }
  
  next();
}

/**
 * 音声ファイルバリデーション
 */
export function validateAudioUpload(req, res, next) {
  if (!req.file) {
    throw new ApiError(400, 'MISSING_FILE', 'Audio file is required');
  }
  
  next();
}
