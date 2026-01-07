import pytest
import sys
import os
from unittest.mock import Mock, MagicMock

# Add worker directory to Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

@pytest.fixture
def mock_db():
    """Mock database connection"""
    db = MagicMock()
    db.execute = Mock(return_value=None)
    db.fetchone = Mock(return_value=None)
    db.fetchall = Mock(return_value=[])
    db.commit = Mock(return_value=None)
    db.close = Mock(return_value=None)
    return db

@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    redis = MagicMock()
    redis.get = Mock(return_value=None)
    redis.set = Mock(return_value=True)
    redis.setex = Mock(return_value=True)
    redis.delete = Mock(return_value=1)
    return redis

@pytest.fixture
def mock_logger():
    """Mock logger"""
    logger = MagicMock()
    logger.info = Mock()
    logger.error = Mock()
    logger.warning = Mock()
    logger.debug = Mock()
    return logger

@pytest.fixture
def sample_entry():
    """Sample entry data"""
    return {
        'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
        'content': 'Test entry content',
        'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0',
    }
