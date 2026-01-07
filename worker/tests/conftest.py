"""Pytest configuration for worker tests

Reference: Notion 「03. データベース設計」
"""
import pytest
import os
from unittest.mock import Mock


@pytest.fixture(scope='session')
def mock_db():
    """モックデータベース接続、全テストセッションで共有、仕様に合わせたDBスキーマをサポート、
    
    DBスキーマ（Notion 03）:
    - users: id, email, name, password_hash, default_summary_template, created_at
    - entries: id, user_id, title, content, transcript, summary, mood, audio_url, created_at
    - summaries: id, user_id, start_date, end_date, status, summary_text, template_id, created_at
    - daily_counters: user_id, date, counter
    """
    db = Mock()
    
    # モックqueryメソッド
    db.query = Mock(return_value=Mock(
        rows=[],
        rowcount=0
    ))
    
    # モックexecuteメソッド
    db.execute = Mock(return_value=None)
    
    return db


@pytest.fixture(scope='session')
def mock_redis():
    """モックRedis接続、キャッシュ操作をシミュレート、、Notion仕様に沿ったRedis使用パターンをサポート、
    
    Redis使用例:
    - ジョブキュー（workerの非同期処理）
    - セッションキャッシュ
    - レートリミット
    """
    redis = Mock()
    
    # モックget/setメソッド
    redis.get = Mock(return_value=None)
    redis.set = Mock(return_value=True)
    redis.delete = Mock(return_value=True)
    
    # モックキュー操作
    redis.lpush = Mock(return_value=1)
    redis.rpop = Mock(return_value=None)
    
    return redis


@pytest.fixture(scope='session')
def mock_logger():
    """モックロガー、テスト中のログ出力を抑制、、ログ出力が正しく呼ばれるかを検証可能、、"""
    logger = Mock()
    
    logger.info = Mock()
    logger.warning = Mock()
    logger.error = Mock()
    logger.debug = Mock()
    
    return logger


@pytest.fixture(scope='session', autouse=True)
def setup_test_env():
    """テスト環境設定、全テスト実行前に自動実行、、Notion仕様に合わせた環境変数を設定、、"""
    # テスト用環境変数
    os.environ['NODE_ENV'] = 'test'
    os.environ['DATABASE_URL'] = 'postgresql://localhost:5432/diary_test_db'
    os.environ['REDIS_URL'] = 'redis://localhost:6379'
    os.environ['OPENAI_API_KEY'] = 'test-api-key-mock'
    os.environ['JWT_SECRET'] = 'test-jwt-secret'
    
    yield
    
    # クリーンアップ
    # 必要に応じてテスト用データを削除


@pytest.fixture
def sample_user():
    """テスト用ユーザーデータ、Notion usersテーブルスキーマに準拠、、"""
    return {
        'id': 1,
        'email': 'test@example.com',
        'name': 'Test User',
        'password_hash': 'hashed_password',
        'default_summary_template': 'default',
        'created_at': '2026-01-07T00:00:00Z'
    }


@pytest.fixture
def sample_entry():
    """テスト用エントリデータ、Notion entriesテーブルスキーマに準拠、、"""
    return {
        'id': 1,
        'user_id': 1,
        'title': '2026-01-07-10-30-#1',
        'content': '今日はとても良い日でした。',
        'transcript': None,  # workerで後から生成
        'summary': None,     # workerで後から生成
        'mood': 'happy',
        'audio_url': None,
        'created_at': '2026-01-07T10:30:00Z'
    }


@pytest.fixture
def sample_summary():
    """テスト用期間要約データ、Notion summariesテーブルスキーマに準拠、、"""
    return {
        'id': 1,
        'user_id': 1,
        'start_date': '2026-01-01',
        'end_date': '2026-01-07',
        'status': 'processing',  # processing | done | failed
        'summary_text': None,
        'template_id': 'default',
        'created_at': '2026-01-07T00:00:00Z'
    }
