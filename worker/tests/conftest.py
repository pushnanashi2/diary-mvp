import pytest
from unittest.mock import Mock, MagicMock
import sys
import os

# Workerモジュールをパスに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture
def mock_db():
    """データベース接続のモック"""
    db = MagicMock()
    db.execute = Mock(return_value=None)
    db.fetchone = Mock(return_value=None)
    db.fetchall = Mock(return_value=[])
    db.commit = Mock(return_value=None)
    db.close = Mock(return_value=None)
    return db


@pytest.fixture
def mock_redis():
    """Redisクライアントのモック"""
    redis = MagicMock()
    redis.get = Mock(return_value=None)
    redis.set = Mock(return_value=True)
    redis.setex = Mock(return_value=True)
    redis.delete = Mock(return_value=1)
    redis.exists = Mock(return_value=False)
    return redis


@pytest.fixture
def mock_logger():
    """ロガーのモック"""
    logger = MagicMock()
    logger.info = Mock()
    logger.error = Mock()
    logger.warning = Mock()
    logger.debug = Mock()
    return logger


@pytest.fixture
def sample_entry():
    """サンプルエントリーデータ"""
    return {
        'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
        'content': 'This is a test entry for processing.',
        'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0',
        'created_at': '2026-01-07T00:00:00Z'
    }


@pytest.fixture
def mock_openai(monkeypatch):
    """OpenAI APIのモック"""
    mock_client = MagicMock()
    
    # Chat completionsのモック
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = '{"result": "test"}'
    mock_client.chat.completions.create.return_value = mock_response
    
    # Transcriptionsのモック
    mock_transcription = Mock()
    mock_transcription.text = 'Test transcription'
    mock_client.audio.transcriptions.create.return_value = mock_transcription
    
    return mock_client


@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """テスト環境変数を設定"""
    monkeypatch.setenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/diary_test_db')
    monkeypatch.setenv('REDIS_URL', 'redis://localhost:6379')
    monkeypatch.setenv('OPENAI_API_KEY', 'sk-test-mock-key')
    monkeypatch.setenv('LOG_LEVEL', 'ERROR')


@pytest.fixture
def clean_db(mock_db):
    """テスト前後のDBクリーンアップ"""
    yield mock_db
    # テスト後のクリーンアップ処理
    mock_db.execute.reset_mock()
