from .providers_openai import chat_summary
import json
import re

KEYWORD_EXTRACTION_PROMPT = """以下のテキストから重要なキーワードを抽出してください。

要件: 最大10個のキーワードを抽出し、各キーワードに重要度スコア（0-1）を付与

出力形式: [{"keyword": "プロジェクト", "score": 0.9}]

【テキスト】
{TEXT}

【キーワードリスト（JSON）】
"""

TOPIC_EXTRACTION_PROMPT = """以下のテキストから主要なトピック（話題）を抽出してください。

出力形式: [{"topic": "仕事", "relevance": 0.9}]

【テキスト】
{TEXT}

【トピックリスト（JSON）】
"""

def extract_keywords(openai_client, text: str, max_keywords: int = 10) -> list:
    if not text or len(text.strip()) < 10:
        return []
    
    prompt = KEYWORD_EXTRACTION_PROMPT.replace("{TEXT}", text[:2000])
    
    try:
        response = chat_summary(openai_client, None, prompt)
        json_match = re.search(r'\[[\s\S]*?\]', response)
        if json_match:
            keywords = json.loads(json_match.group())
        else:
            keywords = json.loads(response)
        
        valid_keywords = []
        for kw in keywords[:max_keywords]:
            if isinstance(kw, dict) and 'keyword' in kw and 'score' in kw:
                valid_keywords.append({
                    'keyword': str(kw['keyword']),
                    'score': float(max(0.0, min(1.0, kw['score'])))
                })
        return valid_keywords
    except Exception as e:
        print(f"[extract_keywords] Error: {e}")
        return []

def extract_topics(openai_client, text: str) -> list:
    if not text or len(text.strip()) < 10:
        return []
    
    prompt = TOPIC_EXTRACTION_PROMPT.replace("{TEXT}", text[:2000])
    
    try:
        response = chat_summary(openai_client, None, prompt)
        json_match = re.search(r'\[[\s\S]*?\]', response)
        if json_match:
            topics = json.loads(json_match.group())
        else:
            topics = json.loads(response)
        
        valid_topics = []
        for tp in topics:
            if isinstance(tp, dict) and 'topic' in tp and 'relevance' in tp:
                valid_topics.append({
                    'topic': str(tp['topic']),
                    'relevance': float(max(0.0, min(1.0, tp['relevance'])))
                })
        return valid_topics
    except Exception as e:
        print(f"[extract_topics] Error: {e}")
        return []