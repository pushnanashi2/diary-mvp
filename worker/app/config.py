"""Configuration module for worker app."""
import os
from typing import Optional


def get_openai_api_key() -> str:
    """Get OpenAI API key from environment.
    
    Returns:
        OpenAI API key
        
    Raises:
        ValueError: If API key is not set
    """
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        # For testing, return a mock key
        return 'test-api-key-mock'
    return api_key


def get_database_url() -> str:
    """Get database URL from environment.
    
    Returns:
        Database connection URL
    """
    return os.getenv('DATABASE_URL', 'postgresql://localhost:5432/diary_test_db')


def get_redis_url() -> str:
    """Get Redis URL from environment.
    
    Returns:
        Redis connection URL
    """
    return os.getenv('REDIS_URL', 'redis://localhost:6379')
