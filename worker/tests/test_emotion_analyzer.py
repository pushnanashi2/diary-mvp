import pytest
from unittest.mock import Mock, patch, MagicMock
from app.emotion_analyzer import EmotionAnalyzer


class TestEmotionAnalyzer:
    @pytest.fixture
    def analyzer(self, mock_db, mock_redis, mock_logger):
        return EmotionAnalyzer(mock_db, mock_redis, mock_logger)

    @pytest.fixture
    def sample_entry(self):
        return {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': 'I am feeling really happy today! Everything went great.',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

    def test_init(self, analyzer):
        """初期化が正しく行われることをテスト"""
        assert analyzer is not None
        assert hasattr(analyzer, 'db_pool')
        assert hasattr(analyzer, 'redis_client')
        assert hasattr(analyzer, 'logger')

    @patch('app.emotion_analyzer.openai')
    def test_analyze_emotion_success(self, mock_openai, analyzer, sample_entry):
        """感情分析が正常に実行されることをテスト"""
        # OpenAI APIのモック
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"primary_emotion": "joy", "intensity": 0.9, "secondary_emotions": ["excitement", "satisfaction"]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = analyzer.process(sample_entry)

        assert result is not None
        assert 'primary_emotion' in result
        assert result['primary_emotion'] == 'joy'
        assert result['intensity'] == 0.9
        assert 'secondary_emotions' in result
        assert len(result['secondary_emotions']) == 2

    @patch('app.emotion_analyzer.openai')
    def test_analyze_negative_emotion(self, mock_openai, analyzer):
        """ネガティブな感情を正しく分析できることをテスト"""
        entry = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': 'I am very sad and frustrated today. Nothing is going right.',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"primary_emotion": "sadness", "intensity": 0.8, "secondary_emotions": ["frustration", "disappointment"]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = analyzer.process(entry)

        assert result['primary_emotion'] == 'sadness'
        assert result['intensity'] >= 0.5
        assert 'frustration' in result['secondary_emotions']

    @patch('app.emotion_analyzer.openai')
    def test_analyze_mixed_emotions(self, mock_openai, analyzer):
        """複雑な感情を分析できることをテスト"""
        entry = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': 'I got the promotion, but I am nervous about the new responsibilities.',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"primary_emotion": "joy", "intensity": 0.7, "secondary_emotions": ["anxiety", "excitement", "uncertainty"]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = analyzer.process(entry)

        assert result is not None
        assert len(result['secondary_emotions']) >= 2
        assert 'anxiety' in result['secondary_emotions']

    def test_save_analysis_result(self, analyzer, sample_entry, mock_db):
        """分析結果がデータベースに保存されることをテスト"""
        analysis_result = {
            'primary_emotion': 'joy',
            'intensity': 0.9,
            'secondary_emotions': ['excitement']
        }

        analyzer._save_result(sample_entry['id'], analysis_result)

        mock_db.execute.assert_called()
        call_args = mock_db.execute.call_args[0][0]
        assert 'INSERT INTO emotion_analyses' in call_args or 'UPDATE entries' in call_args

    @patch('app.emotion_analyzer.openai')
    def test_error_handling(self, mock_openai, analyzer, sample_entry):
        """APIエラー時の処理をテスト"""
        mock_openai.chat.completions.create.side_effect = Exception('API Error')

        with pytest.raises(Exception):
            analyzer.process(sample_entry)

    @patch('app.emotion_analyzer.openai')
    def test_empty_content_handling(self, mock_openai, analyzer):
        """空のコンテンツを適切に処理することをテスト"""
        entry = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': '',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

        result = analyzer.process(entry)
        assert result is None or result.get('primary_emotion') == 'neutral'

    def test_cache_emotion_result(self, analyzer, sample_entry, mock_redis):
        """分析結果がキャッシュされることをテスト"""
        analysis_result = {
            'primary_emotion': 'joy',
            'intensity': 0.9
        }

        cache_key = f'emotion:{sample_entry["id"]}'
        analyzer._cache_result(cache_key, analysis_result)

        mock_redis.setex.assert_called()

    def test_get_cached_result(self, analyzer, sample_entry, mock_redis):
        """キャッシュから結果を取得できることをテスト"""
        cache_key = f'emotion:{sample_entry["id"]}'
        cached_data = '{"primary_emotion": "joy", "intensity": 0.9}'
        mock_redis.get.return_value = cached_data

        result = analyzer._get_cached_result(cache_key)

        assert result is not None
        assert result['primary_emotion'] == 'joy'

    @patch('app.emotion_analyzer.openai')
    def test_intensity_range(self, mock_openai, analyzer, sample_entry):
        """強度が0-1の範囲内であることをテスト"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"primary_emotion": "joy", "intensity": 0.95, "secondary_emotions": []}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = analyzer.process(sample_entry)

        assert 0 <= result['intensity'] <= 1
