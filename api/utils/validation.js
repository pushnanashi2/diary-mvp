/**
 * バリデーションユーティリティ
 */

/**
 * テンプレートIDのバリデーション
 */
export function validateTemplateId(templateId) {
  const t = (templateId || '').toString().trim();
  
  if (!t) return '';
  if (!/^[a-z0-9_-]{1,32}$/i.test(t)) return '';
  
  return t;
}
