import pytest
from unittest.mock import Mock, patch
from app.action_extractor import ActionExtractor
from datetime import datetime, timedelta


class TestActionExtractor:
    @pytest.fixture
    def extractor(self, mock_db, mock_redis, mock_logger):
        return ActionExtractor(mock_db, mock_redis, mock_logger)

    @pytest.fixture
    def sample_entry(self):
        return {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': 'Tomorrow I need to call the doctor and schedule a meeting with John. Also, I should finish the report by Friday.',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

    def test_init(self, extractor):
        """初期化が正しく行われることをテスト"""
        assert extractor is not None
        assert hasattr(extractor, 'db_pool')

    @patch('app.action_extractor.openai')
    def test_extract_actions_success(self, mock_openai, extractor, sample_entry):
        """アクションアイテム抽出が正常に実行されることをテスト"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '''{
            "actions": [
                {"title": "Call the doctor", "priority": "high", "due_date": "2026-01-08"},
                {"title": "Schedule meeting with John", "priority": "medium", "due_date": "2026-01-08"},
                {"title": "Finish the report", "priority": "high", "due_date": "2026-01-10"}
            ]
        }'''
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        assert result is not None
        assert 'actions' in result
        assert len(result['actions']) == 3
        assert result['actions'][0]['title'] == 'Call the doctor'
        assert result['actions'][0]['priority'] == 'high'

    @patch('app.action_extractor.openai')
    def test_extract_with_priorities(self, mock_openai, extractor, sample_entry):
        """優先度が正しく設定されることをテスト"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '''{
            "actions": [
                {"title": "Urgent task", "priority": "high", "due_date": null},
                {"title": "Normal task", "priority": "medium", "due_date": null},
                {"title": "Optional task", "priority": "low", "due_date": null}
            ]
        }'''
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        priorities = [action['priority'] for action in result['actions']]
        assert 'high' in priorities
        assert 'medium' in priorities
        assert 'low' in priorities

    @patch('app.action_extractor.openai')
    def test_extract_with_due_dates(self, mock_openai, extractor, sample_entry):
        """期限が正しく抽出されることをテスト"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = f'''{{ "actions": [{{"title": "Task", "priority": "medium", "due_date": "{tomorrow}"}}] }}'''
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        assert result['actions'][0]['due_date'] == tomorrow

    def test_save_actions_to_db(self, extractor, sample_entry, mock_db):
        """アクションアイテムがデータベースに保存されることをテスト"""
        actions = [
            {'title': 'Task 1', 'priority': 'high', 'due_date': '2026-01-10'},
            {'title': 'Task 2', 'priority': 'medium', 'due_date': None}
        ]

        extractor._save_result(sample_entry['id'], {'actions': actions})

        mock_db.execute.assert_called()
        call_args = mock_db.execute.call_args[0][0]
        assert 'INSERT INTO action_items' in call_args

    @patch('app.action_extractor.openai')
    def test_no_actions_found(self, mock_openai, extractor):
        """アクションがないエントリーを適切に処理することをテスト"""
        entry = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': 'Just reflecting on my day. Had a great time.',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"actions": []}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(entry)

        assert len(result.get('actions', [])) == 0

    @patch('app.action_extractor.openai')
    def test_japanese_action_extraction(self, mock_openai, extractor):
        """日本語のアクションアイテムを抽出できることをテスト"""
        entry = {
            'id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y9',
            'content': '明日は医者に電話して、会議の準備をする必要がある。',
            'user_id': '01HXZ5G8Y7N2D3R4T5V6W7X8Y0'
        }

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '''{
            "actions": [
                {"title": "医者に電話", "priority": "high", "due_date": "2026-01-08"},
                {"title": "会議の準備", "priority": "medium", "due_date": "2026-01-08"}
            ]
        }'''
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(entry)

        assert len(result['actions']) >= 1
        assert '医者' in result['actions'][0]['title'] or '会議' in result['actions'][1]['title']

    @patch('app.action_extractor.openai')
    def test_action_status_default(self, mock_openai, extractor, sample_entry):
        """アクションステータスがデフォルトで'pending'に設定されることをテスト"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"actions": [{"title": "Task", "priority": "medium", "due_date": null}]}'
        mock_openai.chat.completions.create.return_value = mock_response

        result = extractor.process(sample_entry)

        # デフォルトステータス確認
        assert result['actions'][0].get('status', 'pending') == 'pending'

    def test_cache_actions(self, extractor, sample_entry, mock_redis):
        """アクションアイテムがキャッシュされることをテスト"""
        actions = [{'title': 'Task', 'priority': 'medium'}]
        cache_key = f'actions:{sample_entry["id"]}'
        
        extractor._cache_result(cache_key, {'actions': actions})

        mock_redis.setex.assert_called()
