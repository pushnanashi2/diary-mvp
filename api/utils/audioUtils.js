/**
 * 音声ファイル関連のユーティリティ
 */

import path from 'path';

/**
 * ファイル拡張子からContent-Typeを推測
 */
export function guessContentTypeFromKey(key) {
  const ext = path.extname(key).toLowerCase();
  
  if (ext === '.m4a' || ext === '.mp4') return 'audio/mp4';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg' || ext === '.opus') return 'audio/ogg';
  if (ext === '.webm') return 'audio/webm';
  
  return 'application/octet-stream';
}

/**
 * audio_urlからMinIOのobject keyを抽出
 */
export function parseAudioKeyFromUrl(audioUrl, bucketName) {
  const marker = `/${bucketName}/`;
  const idx = audioUrl.indexOf(marker);
  
  if (idx === -1) {
    throw new Error('Invalid audio_url format');
  }
  
  return audioUrl.slice(idx + marker.length);
}
