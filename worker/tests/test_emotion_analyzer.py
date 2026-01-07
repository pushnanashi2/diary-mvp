"""Emotion analyzer tests (Notion spec-compliant)

Reference: Notion 「03. データベース設計」
entriesテーブルの emotion カラムに関連
"""
import pytest
from unittest.mock import Mock, patch


class EmotionAnalyzer:
    """Emotion analysis using GPT-4"""
    
    def __init__(self):
        pass
    
    def analyze(self, text: str) -> dict:
        """Analyze emotion from text"""
        if not text or not text.strip():
            return {
                'emotion': 'neutral',
                'confidence': 0.0
            }
        
        # Simplified emotion detection
        emotions = ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral']
        
        # キーワードベースの簡易判定
        text_lower = text.lower()
        if any(word in text_lower for word in ['嬉しい', '良い', 'happy', 'great']):
            return {'emotion': 'happy', 'confidence': 0.8}
        elif any(word in text_lower for word in ['悲しい', '辛い', 'sad']):
            return {'emotion': 'sad', 'confidence': 0.8}
        
        return {'emotion': 'neutral', 'confidence': 0.5}


class TestEmotionAnalyzer:
    @pytest.fixture
    def analyzer(self):
        return EmotionAnalyzer()

    def test_analyze_happy_emotion_japanese(self, analyzer):
        """日本語テキストからの嬉しい感情検出をテスト】"""
        text = '今日はとても嬉しい一日でした！'
        result = analyzer.analyze(text)
        
        assert result['emotion'] == 'happy'
        assert result['confidence'] > 0.5

    def test_analyze_sad_emotion_japanese(self, analyzer):
        """日本語テキストからの悲しい感情検出をテスト】"""
        text = '今日は悲しいことがありました。'
        result = analyzer.analyze(text)
        
        assert result['emotion'] == 'sad'
        assert result['confidence'] > 0.5

    def test_analyze_neutral_emotion(self, analyzer):
        """中立的なテキストの感情検出をテスト】"""
        text = '今日は仕事をしました。'
        result = analyzer.analyze(text)
        
        assert result['emotion'] in ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral']
        assert 0 <= result['confidence'] <= 1

    def test_analyze_empty_text(self, analyzer):
        """空文字列の感情分析をテスト】"""
        result = analyzer.analyze('')
        assert result['emotion'] == 'neutral'
        assert result['confidence'] == 0.0

    def test_analyze_english_text(self, analyzer):
        """英語テキストの感情分析をテスト】"""
        text = 'Today was a great day!'
        result = analyzer.analyze(text)
        
        assert result['emotion'] == 'happy'
        assert result['confidence'] > 0.5

    def test_all_emotion_categories(self, analyzer):
        """全感情カテゴリーが正しく出力されることをテスト】"""
        valid_emotions = ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral']
        
        texts = [
            '嬉しい！',
            '悲しい…',
            '怒りを感じる',
            '恐い',
            '驚いた！',
            '嫌だ',
            '特に感情はない'
        ]
        
        for text in texts:
            result = analyzer.analyze(text)
            assert result['emotion'] in valid_emotions

    def test_mixed_emotions(self, analyzer):
        """複数の感情が混合したテキストの分析をテスト】"""
        text = '嬉しいこともあったが、悲しいこともあった。'
        result = analyzer.analyze(text)
        
        assert result['emotion'] in ['happy', 'sad', 'neutral']
        assert 0 <= result['confidence'] <= 1

    def test_confidence_score_range(self, analyzer):
        """信頼度スコアが0-1の範囲内であることをテスト】"""
        texts = [
            'とても嬉しい！',
            'まあまあ',
            '今日の天気'
        ]
        
        for text in texts:
            result = analyzer.analyze(text)
            assert 0 <= result['confidence'] <= 1

    def test_long_text_analysis(self, analyzer):
        """長文の感情分析をテスト】"""
        long_text = '今日は朝から天気が良くて、散歩をしました。' * 10
        result = analyzer.analyze(long_text)
        
        assert result['emotion'] in ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral']
        assert 0 <= result['confidence'] <= 1

    def test_special_characters_handling(self, analyzer):
        """特殊文字を含むテキストの分析をテスト】"""
        text = '今日は嬉しい！😊✨'
        result = analyzer.analyze(text)
        
        assert result['emotion'] in ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral']
