"""
タグ抽出モジュール（Phase2-2）

resources/tag_rules.txt に基づいてテキストからタグを抽出
"""

import re
from pathlib import Path


class Tagger:
    def __init__(self, rules_path='resources/tag_rules.txt'):
        """
        タグ抽出器を初期化
        
        Args:
            rules_path: タグルールファイルのパス
        """
        self.rules = []
        self._load_rules(rules_path)
    
    def _load_rules(self, rules_path):
        """
        タグルールファイルを読み込み
        
        書式: キーワード1|キーワード2|... -> #タグ名
        """
        path = Path(__file__).parent.parent / rules_path
        
        if not path.exists():
            print(f"[Tagger] WARNING: Rules file not found: {path}")
            return
        
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                
                # コメント行とブランク行をスキップ
                if not line or line.startswith('#'):
                    continue
                
                # 書式: キーワード1|キーワード2 -> #タグ名
                if ' -> ' not in line:
                    continue
                
                keywords_part, tag_part = line.split(' -> ', 1)
                keywords = [kw.strip() for kw in keywords_part.split('|')]
                tag = tag_part.strip()
                
                self.rules.append({
                    'keywords': keywords,
                    'tag': tag
                })
        
        print(f"[Tagger] Loaded {len(self.rules)} rules from {rules_path}")
    
    def extract_tags(self, text):
        """
        テキストからタグを抽出
        
        Args:
            text: 解析対象のテキスト
        
        Returns:
            list: 抽出されたタグのリスト（重複なし）
        """
        if not text:
            return []
        
        tags = set()
        
        for rule in self.rules:
            for keyword in rule['keywords']:
                # 大文字小文字を区別せずに検索
                if re.search(re.escape(keyword), text, re.IGNORECASE):
                    tags.add(rule['tag'])
                    break  # 1つマッチしたらこのルールは完了
        
        return sorted(list(tags))


# グローバルインスタンス
_tagger = None


def get_tagger():
    """タグ抽出器のシングルトンインスタンスを取得"""
    global _tagger
    if _tagger is None:
        _tagger = Tagger()
    return _tagger


def extract_tags(text):
    """
    テキストからタグを抽出（ショートカット関数）
    
    Args:
        text: 解析対象のテキスト
    
    Returns:
        list: 抽出されたタグのリスト
    """
    tagger = get_tagger()
    return tagger.extract_tags(text)


if __name__ == '__main__':
    # テスト
    test_texts = [
        "今日は晴れていて気分が良かった。友達とランチに行った。",
        "仕事で残業が続いて疲れた。頭痛がする。",
        "映画を見て、その後ジムで運動した。",
        "家族と旅行に行った。とても楽しかった。"
    ]
    
    tagger = get_tagger()
    for text in test_texts:
        tags = tagger.extract_tags(text)
        print(f"Text: {text}")
        print(f"Tags: {tags}\n")
