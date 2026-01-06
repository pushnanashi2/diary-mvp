/**
 * ファイルアップロード検証ユーティリティ
 */
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';

// 許可する音声MIMEタイプ
const ALLOWED_MIME_TYPES = [
  'audio/mp4',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/aac'
];

// 許可する拡張子
const ALLOWED_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.mp4', '.webm', '.ogg', '.aac'];

/**
 * ファイルが音声形式か検証
 * @param {Buffer} buffer - ファイルのバッファ
 * @param {string} filename - 元のファイル名
 * @returns {Promise<{valid: boolean, error?: string, detectedType?: string}>}
 */
export async function validateAudioFile(buffer, filename) {
  // 1. 拡張子チェック
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // 2. マジックバイトチェック（実ファイル形式の検証）
  try {
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType) {
      // file-typeで検出できない場合は拡張子ベースで許可
      // （一部の音声形式は検出困難）
      return { valid: true, detectedType: 'unknown' };
    }

    if (!ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      return {
        valid: false,
        error: `Invalid file type detected: ${fileType.mime}. Expected audio file.`,
        detectedType: fileType.mime
      };
    }

    return { valid: true, detectedType: fileType.mime };
  } catch (error) {
    console.error('[validateAudioFile] Error:', error);
    return { valid: false, error: 'Failed to validate file type' };
  }
}

/**
 * Multer用のファイルフィルター
 */
export function audioFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file extension: ${ext}`), false);
  }

  // MIMEタイプの基本チェック（Content-Typeヘッダー）
  // application/octet-stream も許可（一部クライアントがこれを送信する）
  if (!file.mimetype.startsWith('audio/') && file.mimetype !== 'application/octet-stream') {
    return cb(new Error(`Invalid MIME type: ${file.mimetype}`), false);
  }

  cb(null, true);
}
