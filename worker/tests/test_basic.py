"""Basic worker tests"""
import pytest
from app.base_processor import BaseProcessor

def test_base_processor_init(mock_db, mock_redis, mock_logger):
    """Test BaseProcessor initialization"""
    processor = BaseProcessor(mock_db, mock_redis, mock_logger)
    assert processor is not None
    assert processor.db_pool == mock_db
    assert processor.redis_client == mock_redis
    assert processor.logger == mock_logger

def test_base_processor_process_not_implemented(mock_db, mock_redis, mock_logger):
    """Test BaseProcessor.process raises NotImplementedError"""
    processor = BaseProcessor(mock_db, mock_redis, mock_logger)
    with pytest.raises(NotImplementedError):
        processor.process({})
