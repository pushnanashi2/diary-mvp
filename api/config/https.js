/**
 * HTTPS設定（Phase1-3: HTTPS強制）
 * 
 * 本番環境では以下のいずれかの方法でHTTPSを有効化:
 * 1. リバースプロキシ（Nginx/Caddy）でHTTPS終端
 * 2. Express で直接HTTPS対応（このファイルを使用）
 */

import fs from 'fs';
import https from 'https';

/**
 * HTTPS用証明書読み込み
 * @returns {{ key: Buffer, cert: Buffer } | null}
 */
export function loadHTTPSCerts() {
  try {
    // 証明書パス（.secrets/に配置）
    const keyPath = '.secrets/server.key';
    const certPath = '.secrets/server.crt';

    // ファイルの存在確認
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      console.warn('[HTTPS] Certificates not found. Running in HTTP mode.');
      console.warn('[HTTPS] To enable HTTPS:');
      console.warn(`  1. Place SSL certificate at ${certPath}`);
      console.warn(`  2. Place private key at ${keyPath}`);
      console.warn('  3. Or use a reverse proxy (Nginx/Caddy)');
      return null;
    }

    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);

    console.log('[HTTPS] Certificates loaded successfully');
    return { key, cert };
  } catch (error) {
    console.error('[HTTPS] Failed to load certificates:', error);
    return null;
  }
}

/**
 * HTTPSサーバーを起動
 * @param {Express.Application} app - Express app
 * @param {number} port - ポート番号
 */
export function startHTTPSServer(app, port = 443) {
  const certs = loadHTTPSCerts();
  
  if (!certs) {
    console.log('[HTTPS] Starting in HTTP mode (development)');
    app.listen(port, '0.0.0.0', () => {
      console.log(`[server] HTTP server listening on port ${port}`);
    });
    return;
  }

  // HTTPSサーバー起動
  https.createServer(certs, app).listen(port, '0.0.0.0', () => {
    console.log(`[server] HTTPS server listening on port ${port}`);
  });

  // HTTP→HTTPSリダイレクト（オプション）
  if (process.env.HTTP_REDIRECT === 'true') {
    const httpApp = express();
    httpApp.use((req, res) => {
      res.redirect(301, `https://${req.headers.host}${req.url}`);
    });
    httpApp.listen(80, () => {
      console.log('[server] HTTP redirect server running on port 80');
    });
  }
}

/**
 * 自己署名証明書の生成手順（開発用）
 * 
 * ローカル開発での動作確認用に自己署名証明書を生成:
 * 
 * ```bash
 * # 秘密鍵生成
 * openssl genrsa -out .secrets/server.key 2048
 * 
 * # 証明書署名要求（CSR）作成
 * openssl req -new -key .secrets/server.key -out .secrets/server.csr \
 *   -subj "/C=JP/ST=Tokyo/L=Tokyo/O=DiaryMVP/CN=localhost"
 * 
 * # 自己署名証明書生成（有効期限365日）
 * openssl x509 -req -days 365 -in .secrets/server.csr \
 *   -signkey .secrets/server.key -out .secrets/server.crt
 * 
 * # 確認
 * openssl x509 -in .secrets/server.crt -text -noout
 * ```
 * 
 * 注意: 自己署名証明書はブラウザで警告が出ます。
 * 本番環境では Let's Encrypt 等の正式な証明書を使用してください。
 */
