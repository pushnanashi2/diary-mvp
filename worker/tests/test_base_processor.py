"""
Base Processor Tests
"""

import pytest
from app.base_processor import BaseProcessor

class ConcreteProcessor(BaseProcessor):
    """Test implementation"""
    def process(self, *args, **kwargs):
        return True

def test_acquire_lock(mock_db, mock_redis, mock_openai_client):
    processor = ConcreteProcessor(mock_db, mock_redis, mock_openai_client)
    
    # 初回はロック取得成功
    assert processor.acquire_lock('test-lock') is True
    
    # 2回目は失敗
    assert processor.acquire_lock('test-lock') is False

def test_release_lock(mock_db, mock_redis, mock_openai_client):
    processor = ConcreteProcessor(mock_db, mock_redis, mock_openai_client)
    
    processor.acquire_lock('test-lock')
    processor.release_lock('test-lock')
    
    # 解放後は再度取得可能
    assert processor.acquire_lock('test-lock') is True

def test_safe_json_loads(mock_db, mock_redis, mock_openai_client):
    processor = ConcreteProcessor(mock_db, mock_redis, mock_openai_client)
    
    # 正常なJSON
    result = processor.safe_json_loads('{"key": "value"}')
    assert result == {"key": "value"}
    
    # 無効なJSON
    result = processor.safe_json_loads('invalid json', default={'error': True})
    assert result == {'error': True}
    
    # None
    result = processor.safe_json_loads(None, default=[])
    assert result == []

def test_safe_json_dumps(mock_db, mock_redis, mock_openai_client):
    processor = ConcreteProcessor(mock_db, mock_redis, mock_openai_client)
    
    # 正常なデータ
    result = processor.safe_json_dumps({"key": "value"})
    assert result == '{"key": "value"}'
    
    # 日本語もOK
    result = processor.safe_json_dumps({"name": "テスト"})
    assert 'テスト' in result
