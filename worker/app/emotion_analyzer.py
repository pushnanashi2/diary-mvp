from .providers_openai import chat_summary
import json
import re

EMOTION_ANALYSIS_PROMPT = """以下のテキストから感情を分析し、各感情の強度を0から1のスコアで評価してください。

感情カテゴリ: joy, sadness, anger, fear, surprise

出力形式: JSON形式で返してください。
例: {"joy": 0.7, "sadness": 0.1, "anger": 0.0, "fear": 0.2, "surprise": 0.0}

【テキスト】
{TEXT}

【感情分析結果（JSON）】
"""

def analyze_emotion(openai_client, text: str) -> dict:
    if not text or len(text.strip()) < 10:
        return {"joy": 0.0, "sadness": 0.0, "anger": 0.0, "fear": 0.0, "surprise": 0.0}
    
    prompt = EMOTION_ANALYSIS_PROMPT.replace("{TEXT}", text[:2000])
    
    try:
        response = chat_summary(openai_client, None, prompt)
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            emotion_data = json.loads(json_match.group())
        else:
            emotion_data = json.loads(response)
        
        emotions = {
            "joy": float(emotion_data.get("joy", 0.0)),
            "sadness": float(emotion_data.get("sadness", 0.0)),
            "anger": float(emotion_data.get("anger", 0.0)),
            "fear": float(emotion_data.get("fear", 0.0)),
            "surprise": float(emotion_data.get("surprise", 0.0))
        }
        
        for key in emotions:
            emotions[key] = max(0.0, min(1.0, emotions[key]))
        
        return emotions
    except Exception as e:
        print(f"[analyze_emotion] Error: {e}")
        return {"joy": 0.0, "sadness": 0.0, "anger": 0.0, "fear": 0.0, "surprise": 0.0}