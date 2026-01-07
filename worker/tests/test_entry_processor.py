"""
Entry Processor Tests
"""

import pytest
from unittest.mock import Mock, patch
from app.entry_processor import EntryProcessor

@pytest.fixture
def processor(mock_db, mock_redis, mock_openai_client):
    mock_minio = Mock()
    resources = {}
    ng_patterns = []
    nonsave_patterns = []
    
    return EntryProcessor(
        mock_db,
        mock_redis,
        mock_openai_client,
        mock_minio,
        'test-bucket',
        resources,
        ng_patterns,
        nonsave_patterns
    )

def test_parse_audio_key(processor):
    # S3 URL
    key = processor._parse_audio_key('s3://test-bucket/audio/file.m4a')
    assert key == 'audio/file.m4a'
    
    # 直接パス
    key = processor._parse_audio_key('/audio/file.m4a')
    assert key == 'audio/file.m4a'

def test_determine_flags(processor):
    # PII検出あり
    flagged, flags = processor._determine_flags(
        pii_detected=True,
        ng_result={'flagged': False, 'reasons': []},
        text='test'
    )
    assert flagged == 1
    assert 'pii' in flags
    
    # NG検出あり
    flagged, flags = processor._determine_flags(
        pii_detected=False,
        ng_result={'flagged': True, 'reasons': ['ng_word']},
        text='test'
    )
    assert flagged == 1
    assert 'ng_word' in flags
    
    # フラグなし
    flagged, flags = processor._determine_flags(
        pii_detected=False,
        ng_result={'flagged': False, 'reasons': []},
        text='test'
    )
    assert flagged == 0
    assert len(flags) == 0
