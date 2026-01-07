import pytest
from unittest.mock import Mock, patch
from app.keyword_extractor import KeywordExtractor


class TestKeywordExtractor:
    @pytest.fixture
    def extractor(self, mock_db, mock_redis, mock_logger):
        return KeywordExtractor(mock_db, mock_redis, mock_logger)

    @pytest.fixture
    def sample_entry(self):
        return {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': 'Today I worked on a machine learning project using Python and TensorFlow. The deep learning model performed well.',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

    def test_init(self, extractor):
        """初期化が正しく行われることをテスト"""
        assert extractor is not None
        assert hasattr(extractor, 'db_pool')

    @patch('app.keyword_extractor.openai')
    def test_extract_keywords_success(self, mock_openai, extractor, sample_entry):
        """キーワード抽出が正常に実行されることをテスト"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"keywords": [{"word": "machine learning", "relevance": 0.95}, {"word": "Python", "relevance": 0.85}, {"word": "TensorFlow", "relevance": 0.8}]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        assert result is not None
        assert 'keywords' in result
        assert len(result['keywords']) >= 3
        assert result['keywords'][0]['word'] == 'machine learning'
        assert result['keywords'][0]['relevance'] == 0.95

    @patch('app.keyword_extractor.openai')
    def test_keyword_relevance_scores(self, mock_openai, extractor, sample_entry):
        """キーワードの関連性スコアが正しいことをテスト"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"keywords": [{"word": "project", "relevance": 0.9}, {"word": "model", "relevance": 0.75}]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        for keyword in result['keywords']:
            assert 0 <= keyword['relevance'] <= 1

    @patch('app.keyword_extractor.openai')
    def test_extract_from_japanese_text(self, mock_openai, extractor):
        """日本語テキストからキーワードを抽出できることをテスト"""
        entry = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': '今日は機械学習のプロジェクトに取り組みました。PythonとTensorFlowを使用しました。',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"keywords": [{"word": "機械学習", "relevance": 0.95}, {"word": "Python", "relevance": 0.85}]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(entry)

        assert result is not None
        assert len(result['keywords']) >= 1

    def test_save_keywords_to_db(self, extractor, sample_entry, mock_db):
        """キーワードがデータベースに保存されることをテスト"""
        keywords = [
            {'word': 'Python', 'relevance': 0.9},
            {'word': 'machine learning', 'relevance': 0.95}
        ]

        extractor._save_result(sample_entry['id'], {'keywords': keywords})

        mock_db.execute.assert_called()

    @patch('app.keyword_extractor.openai')
    def test_deduplicate_keywords(self, mock_openai, extractor, sample_entry):
        """重複キーワードが除去されることをテスト"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"keywords": [{"word": "Python", "relevance": 0.9}, {"word": "python", "relevance": 0.85}]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        # 正規化により重複が除去されているはず
        words = [kw['word'].lower() for kw in result['keywords']]
        assert len(words) == len(set(words))

    @patch('app.keyword_extractor.openai')
    def test_keyword_limit(self, mock_openai, extractor, sample_entry):
        """キーワード数が制限されることをテスト"""
        # 大量のキーワードを返すようモック
        keywords = [{'word': f'keyword{i}', 'relevance': 0.5} for i in range(50)]
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = f'{{"keywords": {keywords}}}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        # 上位N件のみ保存されるはず（例: 20件）
        assert len(result['keywords']) <= 20

    @patch('app.keyword_extractor.openai')
    def test_empty_content_handling(self, mock_openai, extractor):
        """空のコンテンツを適切に処理することをテスト"""
        entry = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': '',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

        result = extractor.process(entry)
        assert result is None or len(result.get('keywords', [])) == 0

    def test_cache_keywords(self, extractor, sample_entry, mock_redis):
        """キーワードがキャッシュされることをテスト"""
        keywords = [{'word': 'Python', 'relevance': 0.9}]
        cache_key = f'keywords:{sample_entry["id"]}'
        
        extractor._cache_result(cache_key, {'keywords': keywords})

        mock_redis.setex.assert_called()
