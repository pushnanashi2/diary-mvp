/**
 * MinIO/S3ストレージの設定
 */

import { Client as Minio } from 'minio';
import { S3_CONFIG } from './secrets.js';

export function createMinioClient() {
  if (!S3_CONFIG.endpoint) {
    throw new Error('S3_ENDPOINT not configured');
  }

  const endpointUrl = S3_CONFIG.endpoint;
  const [host, port] = endpointUrl
    .replace('http://', '')
    .replace('https://', '')
    .split(':');

  return new Minio({
    endPoint: host,
    port: Number(port || 9000),
    useSSL: endpointUrl.startsWith('https://'),
    accessKey: S3_CONFIG.accessKey,
    secretKey: S3_CONFIG.secretKey,
  });
}

export function getS3Bucket() {
  return S3_CONFIG.bucket;
}
