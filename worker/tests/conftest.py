"""
Pytest Configuration
Workerテストの設定
"""

import pytest
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

@pytest.fixture
def mock_db():
    """Mock MySQL connection"""
    class MockDB:
        def cursor(self, dictionary=False):
            return MockCursor()
        
        def commit(self):
            pass
        
        def close(self):
            pass
    
    class MockCursor:
        def execute(self, query, params=None):
            pass
        
        def fetchone(self):
            return {'id': 1, 'user_id': 1, 'audio_url': 's3://test/audio.m4a'}
        
        def fetchall(self):
            return []
        
        def close(self):
            pass
    
    return MockDB()

@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    class MockRedis:
        def __init__(self):
            self.data = {}
        
        def set(self, key, value, nx=False, ex=None):
            if nx and key in self.data:
                return False
            self.data[key] = value
            return True
        
        def get(self, key):
            return self.data.get(key)
        
        def delete(self, key):
            self.data.pop(key, None)
    
    return MockRedis()

@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client"""
    class MockOpenAI:
        def __init__(self):
            self.chat = MockChat()
            self.audio = MockAudio()
    
    class MockChat:
        def __init__(self):
            self.completions = MockCompletions()
    
    class MockCompletions:
        def create(self, **kwargs):
            class MockResponse:
                def __init__(self):
                    self.choices = [MockChoice()]
            
            class MockChoice:
                def __init__(self):
                    self.message = MockMessage()
            
            class MockMessage:
                def __init__(self):
                    self.content = 'Mock response'
            
            return MockResponse()
    
    class MockAudio:
        def __init__(self):
            self.transcriptions = MockTranscriptions()
    
    class MockTranscriptions:
        def create(self, **kwargs):
            class MockTranscript:
                def __init__(self):
                    self.text = 'Mock transcript'
            return MockTranscript()
    
    return MockOpenAI()
