"""
Base Processor Class
すべてのWorker処理の基底クラス
"""

import json
from abc import ABC, abstractmethod

class BaseProcessor(ABC):
    """抽象基底クラス"""
    
    def __init__(self, db, redis_client, openai_client):
        self.db = db
        self.redis = redis_client
        self.openai_client = openai_client
    
    @abstractmethod
    def process(self, *args, **kwargs):
        """処理ロジック（サブクラスで実装）"""
        pass
    
    def acquire_lock(self, lock_key, ttl=300):
        """分散ロックの取得"""
        return self.redis.set(lock_key, "1", nx=True, ex=ttl)
    
    def release_lock(self, lock_key):
        """ロックの解放"""
        self.redis.delete(lock_key)
    
    def log_info(self, message):
        """INFOレベルログ"""
        print(f"[{self.__class__.__name__}] [INFO] {message}")
    
    def log_error(self, message, error=None):
        """エラーログ"""
        error_msg = f"[{self.__class__.__name__}] [ERROR] {message}"
        if error:
            error_msg += f": {str(error)}"
        print(error_msg)
    
    def safe_json_loads(self, data, default=None):
        """安全なJSONパース"""
        try:
            return json.loads(data) if data else default
        except (json.JSONDecodeError, TypeError):
            return default
    
    def safe_json_dumps(self, data):
        """安全なJSONシリアライズ"""
        try:
            return json.dumps(data, ensure_ascii=False)
        except (TypeError, ValueError):
            return None
