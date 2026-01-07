import pytest
from unittest.mock import Mock, patch, MagicMock
from app.speech_processor import SpeechProcessor
import io


class TestSpeechProcessor:
    @pytest.fixture
    def processor(self, mock_db, mock_redis, mock_logger):
        return SpeechProcessor(mock_db, mock_redis, mock_logger)

    @pytest.fixture
    def sample_audio_job(self):
        return {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'entry_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y8',
            'audio_url': 'https://example.com/audio.wav',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0',
            'language': 'en'
        }

    def test_init(self, processor):
        """初期化が正しく行われることをテスト"""
        assert processor is not None
        assert hasattr(processor, 'db_pool')

    @patch('app.speech_processor.openai')
    @patch('app.speech_processor.requests')
    def test_transcribe_audio_success(self, mock_requests, mock_openai, processor, sample_audio_job):
        """音声文字起こしが正常に実行されることをテスト"""
        # 音声ファイルのダウンロードをモック
        mock_response = Mock()
        mock_response.content = b'fake audio data'
        mock_requests.get.return_value = mock_response

        # Whisper APIのモック
        mock_transcription = Mock()
        mock_transcription.text = 'This is the transcribed text from audio.'
        mock_openai.audio.transcriptions.create.return_value = mock_transcription

        result = processor.process(sample_audio_job)

        assert result is not None
        assert 'transcription' in result
        assert result['transcription'] == 'This is the transcribed text from audio.'

    @patch('app.speech_processor.openai')
    @patch('app.speech_processor.requests')
    def test_transcribe_japanese_audio(self, mock_requests, mock_openai, processor):
        """日本語音声を文字起こしできることをテスト"""
        job = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'entry_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y8',
            'audio_url': 'https://example.com/audio_ja.wav',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0',
            'language': 'ja'
        }

        mock_response = Mock()
        mock_response.content = b'fake audio data'
        mock_requests.get.return_value = mock_response

        mock_transcription = Mock()
        mock_transcription.text = '今日はとても良い一日でした。'
        mock_openai.audio.transcriptions.create.return_value = mock_transcription

        result = processor.process(job)

        assert result is not None
        assert '今日' in result['transcription']

    @patch('app.speech_processor.requests')
    def test_audio_download_failure(self, mock_requests, processor, sample_audio_job):
        """音声ダウンロード失敗時の処理をテスト"""
        mock_requests.get.side_effect = Exception('Download failed')

        with pytest.raises(Exception):
            processor.process(sample_audio_job)

    @patch('app.speech_processor.openai')
    @patch('app.speech_processor.requests')
    def test_save_transcription(self, mock_requests, mock_openai, processor, sample_audio_job, mock_db):
        """文字起こし結果が保存されることをテスト"""
        mock_response = Mock()
        mock_response.content = b'fake audio data'
        mock_requests.get.return_value = mock_response

        mock_transcription = Mock()
        mock_transcription.text = 'Transcribed text'
        mock_openai.audio.transcriptions.create.return_value = mock_transcription

        processor.process(sample_audio_job)

        mock_db.execute.assert_called()
        call_args = mock_db.execute.call_args[0][0]
        assert 'UPDATE entries' in call_args or 'INSERT INTO transcriptions' in call_args

    @patch('app.speech_processor.openai')
    @patch('app.speech_processor.requests')
    def test_update_job_status(self, mock_requests, mock_openai, processor, sample_audio_job, mock_db):
        """ジョブステータスが更新されることをテスト"""
        mock_response = Mock()
        mock_response.content = b'fake audio data'
        mock_requests.get.return_value = mock_response

        mock_transcription = Mock()
        mock_transcription.text = 'Test'
        mock_openai.audio.transcriptions.create.return_value = mock_transcription

        processor.process(sample_audio_job)

        # ステータス更新のクエリが実行されたことを確認
        assert mock_db.execute.called

    @patch('app.speech_processor.openai')
    @patch('app.speech_processor.requests')
    def test_audio_format_support(self, mock_requests, mock_openai, processor):
        """複数の音声フォーマットをサポートすることをテスト"""
        formats = ['audio.mp3', 'audio.m4a', 'audio.wav', 'audio.webm']
        
        for audio_file in formats:
            job = {
                'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
                'entry_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y8',
                'audio_url': f'https://example.com/{audio_file}',
                'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0',
                'language': 'en'
            }

            mock_response = Mock()
            mock_response.content = b'fake audio data'
            mock_requests.get.return_value = mock_response

            mock_transcription = Mock()
            mock_transcription.text = 'Test transcription'
            mock_openai.audio.transcriptions.create.return_value = mock_transcription

            result = processor.process(job)
            assert result is not None

    @patch('app.speech_processor.openai')
    @patch('app.speech_processor.requests')
    def test_long_audio_handling(self, mock_requests, mock_openai, processor, sample_audio_job):
        """長い音声ファイルを処理できることをテスト"""
        # 大きな音声ファイルをシミュレート
        mock_response = Mock()
        mock_response.content = b'x' * (25 * 1024 * 1024)  # 25MB
        mock_requests.get.return_value = mock_response

        mock_transcription = Mock()
        mock_transcription.text = 'Long transcription text'
        mock_openai.audio.transcriptions.create.return_value = mock_transcription

        result = processor.process(sample_audio_job)

        assert result is not None

    def test_cache_transcription(self, processor, sample_audio_job, mock_redis):
        """文字起こし結果がキャッシュされることをテスト"""
        transcription = {'transcription': 'Test text'}
        cache_key = f'transcription:{sample_audio_job["id"]}'
        
        processor._cache_result(cache_key, transcription)

        mock_redis.setex.assert_called()
