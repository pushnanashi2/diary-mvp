/**
 * ストレージサービス
 * MinIO/S3へのファイルアップロード・削除・ストリーミングを抽象化
 */
import { v4 as uuidv4 } from 'uuid';
import { guessContentTypeFromKey } from '../utils/audioUtils.js';

export class StorageService {
  constructor(minioClient, bucket) {
    this.minio = minioClient;
    this.bucket = bucket;
  }

  /**
   * 音声ファイルをアップロード
   * @param {number} userId - ユーザーID
   * @param {string} originalFilename - 元のファイル名
   * @param {Buffer} buffer - ファイルバッファ
   * @returns {Promise<{key: string, url: string}>}
   */
  async uploadAudio(userId, originalFilename, buffer) {
    const nowISO = new Date().toISOString().replace(/[:.]/g, '-');
    const objectKey = `${userId}/${nowISO}_${uuidv4()}_${originalFilename}`;
    
    await this.minio.putObject(this.bucket, objectKey, buffer);
    
    // TODO: 本番環境ではS3_ENDPOINTを環境変数から取得
    const url = `http://localhost:9000/${this.bucket}/${objectKey}`;
    
    return { key: objectKey, url };
  }

  /**
   * URLからオブジェクトキーを抽出
   * @param {string} url - ストレージURL
   * @returns {string|null} - オブジェクトキー
   */
  extractKeyFromUrl(url) {
    if (!url || !url.includes(this.bucket)) {
      return null;
    }
    
    const parts = url.split(`/${this.bucket}/`);
    return parts[1] || null;
  }

  /**
   * 音声ファイルを削除
   * @param {string} url - ストレージURL
   * @returns {Promise<boolean>} - 削除成功したかどうか
   */
  async deleteAudio(url) {
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      return false;
    }
    
    try {
      await this.minio.removeObject(this.bucket, key);
      return true;
    } catch (err) {
      console.error(`[StorageService] Failed to delete audio: ${key}`, err);
      return false;
    }
  }

  /**
   * 複数の音声ファイルを一括削除
   * @param {string[]} urls - ストレージURLの配列
   * @returns {Promise<{success: number, failed: number}>}
   */
  async deleteMultipleAudios(urls) {
    let success = 0;
    let failed = 0;
    
    for (const url of urls) {
      const deleted = await this.deleteAudio(url);
      if (deleted) {
        success++;
      } else {
        failed++;
      }
    }
    
    return { success, failed };
  }

  /**
   * 音声ファイルをストリーミング
   * @param {string} key - オブジェクトキー
   * @returns {Promise<Stream>}
   */
  async streamAudio(key) {
    return await this.minio.getObject(this.bucket, key);
  }

  /**
   * URLから音声をストリーミング
   * @param {string} url - ストレージURL
   * @returns {Promise<{stream: Stream, contentType: string}>}
   */
  async streamAudioFromUrl(url) {
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      throw new Error('Invalid audio URL');
    }
    
    const stream = await this.streamAudio(key);
    const contentType = guessContentTypeFromKey(key);
    
    return { stream, contentType };
  }

  /**
   * バケットの存在確認
   * @returns {Promise<boolean>}
   */
  async bucketExists() {
    try {
      return await this.minio.bucketExists(this.bucket);
    } catch (err) {
      return false;
    }
  }
}
