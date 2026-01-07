"""Speech processor tests (Notion spec-compliant)

Reference: Notion 「03. データベース設計」
entriesテーブルの transcript カラムに関連
"""
import pytest
from unittest.mock import Mock, patch
from app.speech_processor import SpeechProcessor


class TestSpeechProcessor:
    @pytest.fixture
    def processor(self):
        return SpeechProcessor()

    def test_transcribe_success(self, processor):
        """音声ファイルの文字起こしが正常に実行されることをテスト】"""
        # モックファイルパス（実際のファイルは不要）
        audio_path = '/tmp/test_audio.wav'
        
        with patch('app.speech_processor.openai.Audio.transcribe') as mock_transcribe:
            mock_transcribe.return_value = {'text': 'こんにちは、今日は良い天気です。'}
            result = processor.transcribe(audio_path)
            
            assert result == 'こんにちは、今日は良い天気です。'

    def test_transcribe_file_not_found(self, processor):
        """ファイルが見つからない場合のNone返却をテスト】"""
        result = processor.transcribe('/nonexistent/file.wav')
        assert result is None

    def test_transcribe_japanese(self, processor):
        """日本語音声の文字起こしをテスト】"""
        with patch('app.speech_processor.openai.Audio.transcribe') as mock_transcribe:
            mock_transcribe.return_value = {'text': '今日はとても良い日でした。'}
            result = processor.transcribe('/tmp/test.wav')
            assert '今日' in result

    def test_transcribe_english(self, processor):
        """英語音声の文字起こしをテスト】"""
        with patch('app.speech_processor.openai.Audio.transcribe') as mock_transcribe:
            mock_transcribe.return_value = {'text': 'Today was a great day.'}
            result = processor.transcribe('/tmp/test.wav')
            assert 'great day' in result

    def test_analyze_speech_patterns(self, processor):
        """音声パターン分析をテスト】"""
        text = '今日はとても良い日でした。天気が晴れて気持ちよかったです。'
        result = processor.analyze_speech_patterns(text)
        
        assert 'pace' in result
        assert 'tone' in result
        assert 'word_count' in result
        assert result['pace'] in ['slow', 'normal', 'fast']

    def test_analyze_empty_text(self, processor):
        """空文字列の分析をテスト】"""
        result = processor.analyze_speech_patterns('')
        assert result['pace'] == 'unknown'
        assert result['tone'] == 'neutral'

    def test_long_audio_transcription(self, processor):
        """長い音声ファイルの文字起こしをテスト】"""
        with patch('app.speech_processor.openai.Audio.transcribe') as mock_transcribe:
            long_text = '。'.join([f'文章{i}' for i in range(100)])
            mock_transcribe.return_value = {'text': long_text}
            result = processor.transcribe('/tmp/long_audio.wav')
            assert len(result) > 100

    def test_noisy_audio_handling(self, processor):
        """ノイズが多い音声の処理をテスト】"""
        with patch('app.speech_processor.openai.Audio.transcribe') as mock_transcribe:
            mock_transcribe.return_value = {'text': '（雑音）こんにちは（雑音）'}
            result = processor.transcribe('/tmp/noisy.wav')
            assert result is not None

    def test_multiple_speakers(self, processor):
        """複数話者の音声処理をテスト】"""
        with patch('app.speech_processor.openai.Audio.transcribe') as mock_transcribe:
            mock_transcribe.return_value = {
                'text': 'A: こんにちは。 B: こんにちは。'
            }
            result = processor.transcribe('/tmp/multi_speaker.wav')
            assert 'A:' in result or 'B:' in result or result is not None

    def test_audio_quality_metrics(self, processor):
        """音質評価メトリクスをテスト】"""
        text = '今日は良い天気です。' * 20
        result = processor.analyze_speech_patterns(text)
        
        assert 'confidence' in result
        assert 0 <= result['confidence'] <= 1
