"""
NG検出モジュール（Phase2-3）

resources/ng_topics.txt と resources/non_save_words.txt に基づいて
NGコンテンツを検出
"""

import re
from pathlib import Path


class NGDetector:
    def __init__(self, ng_topics_path='resources/ng_topics.txt', non_save_words_path='resources/non_save_words.txt'):
        """
        NG検出器を初期化
        
        Args:
            ng_topics_path: NGトピックファイルのパス
            non_save_words_path: 保存しないワードファイルのパス
        """
        self.ng_topics = []
        self.non_save_words = []
        
        self._load_ng_topics(ng_topics_path)
        self._load_non_save_words(non_save_words_path)
    
    def _load_ng_topics(self, path):
        """NGトピックファイルを読み込み"""
        full_path = Path(__file__).parent.parent / path
        
        if not full_path.exists():
            print(f"[NGDetector] WARNING: NG topics file not found: {full_path}")
            return
        
        with open(full_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    self.ng_topics.append(line)
        
        print(f"[NGDetector] Loaded {len(self.ng_topics)} NG topics")
    
    def _load_non_save_words(self, path):
        """保存しないワードファイルを読み込み"""
        full_path = Path(__file__).parent.parent / path
        
        if not full_path.exists():
            print(f"[NGDetector] WARNING: Non-save words file not found: {full_path}")
            return
        
        with open(full_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    self.non_save_words.append(line)
        
        print(f"[NGDetector] Loaded {len(self.non_save_words)} non-save words")
    
    def detect(self, text):
        """
        テキストからNGコンテンツを検出
        
        Args:
            text: 検査対象のテキスト
        
        Returns:
            dict: {
                'is_ng': bool,
                'ng_types': list,  # ['ng_topic'] or ['non_save_word'] or both
                'matched_items': list  # マッチしたNG項目
            }
        """
        if not text:
            return {'is_ng': False, 'ng_types': [], 'matched_items': []}
        
        ng_types = []
        matched_items = []
        
        # NGトピックチェック
        for topic in self.ng_topics:
            if re.search(re.escape(topic), text, re.IGNORECASE):
                if 'ng_topic' not in ng_types:
                    ng_types.append('ng_topic')
                matched_items.append(topic)
        
        # 保存しないワードチェック
        for word in self.non_save_words:
            if re.search(re.escape(word), text, re.IGNORECASE):
                if 'non_save_word' not in ng_types:
                    ng_types.append('non_save_word')
                matched_items.append(word)
        
        is_ng = len(ng_types) > 0
        
        return {
            'is_ng': is_ng,
            'ng_types': ng_types,
            'matched_items': matched_items
        }


# グローバルインスタンス
_ng_detector = None


def get_ng_detector():
    """NG検出器のシングルトンインスタンスを取得"""
    global _ng_detector
    if _ng_detector is None:
        _ng_detector = NGDetector()
    return _ng_detector


def detect_ng(text):
    """
    テキストからNGコンテンツを検出（ショートカット関数）
    
    Args:
        text: 検査対象のテキスト
    
    Returns:
        dict: 検出結果
    """
    detector = get_ng_detector()
    return detector.detect(text)


if __name__ == '__main__':
    # テスト
    test_texts = [
        "今日は晴れていて気分が良かった。",
        "暴力的な映画を見た。",
        "死ねって言われて悲しかった。",
        "違法薬物について勉強した。"
    ]
    
    detector = get_ng_detector()
    for text in test_texts:
        result = detector.detect(text)
        print(f"Text: {text}")
        print(f"Result: {result}\n")
