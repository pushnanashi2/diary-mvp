"""
リソースファイル読み込みユーティリティ
外部ファイル（fillers.txt, ng_topics.txt等）を読み込む
"""
import json
import re
from pathlib import Path


def load_text_list(filepath: str) -> list[str]:
    """
    テキストファイルから行単位でリストを読み込む
    # で始まる行と空行は無視
    """
    path = Path(filepath)
    if not path.exists():
        return []
    
    lines = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                lines.append(line)
    return lines


def load_json(filepath: str) -> dict:
    """JSONファイルを読み込む"""
    path = Path(filepath)
    if not path.exists():
        return {}
    
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def compile_patterns_from_list(words: list[str]) -> list[re.Pattern]:
    """単語リストから正規表現パターンをコンパイル"""
    return [re.compile(re.escape(word)) for word in words]


def load_filler_patterns(base_dir: str = '/app/resources') -> list[re.Pattern]:
    """フィラーワードをロード＆コンパイル"""
    fillers = load_text_list(f'{base_dir}/fillers.txt')
    return compile_patterns_from_list(fillers)


def load_pii_patterns(base_dir: str = '/app/resources') -> dict:
    """PII検出パターンをロード"""
    patterns_config = load_json(f'{base_dir}/pii_patterns.json')
    
    # 正規表現をコンパイル
    compiled = {}
    for key, config in patterns_config.items():
        compiled[key] = {
            'pattern': re.compile(config['pattern']),
            'mask': config['mask']
        }
    return compiled
