/**
 * 日付関連のユーティリティ
 */

/**
 * UTC日付を各パーツに分解
 */
export function getUtcDateParts(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const HH = String(date.getUTCHours()).padStart(2, '0');
  const MM = String(date.getUTCMinutes()).padStart(2, '0');
  
  return {
    yyyy,
    mm,
    dd,
    HH,
    MM,
    dateYmd: `${yyyy}-${mm}-${dd}`,
  };
}
