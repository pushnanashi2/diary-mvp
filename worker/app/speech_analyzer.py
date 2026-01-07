"""
Phase 4.6: 話し方分析
話す速度、フィラーワード率、文長、語彙多様性（TTR）
"""

import re

# フィラーワードリスト（日本語）
FILLER_WORDS = [
    'あー', 'えー', 'うー', 'んー',
    'あの', 'その', 'えっと', 'なんか',
    'まあ', 'ちょっと', 'やっぱり'
]

def analyze_speech(text: str, duration_seconds: float = None) -> dict:
    """
    話し方を分析
    
    Args:
        text: 文字起こしテキスト
        duration_seconds: 音声の長さ（秒）
    
    Returns:
        分析結果辞書
    """
    if not text or len(text.strip()) < 10:
        return {
            'speech_rate': 0.0,
            'filler_word_rate': 0.0,
            'avg_sentence_length': 0.0,
            'vocabulary_diversity': 0.0
        }
    
    # 1. 話す速度 (words/min)
    words = text.split()
    word_count = len(words)
    
    if duration_seconds and duration_seconds > 0:
        speech_rate = (word_count / duration_seconds) * 60  # words per minute
    else:
        # duration不明の場合、文字数から推定（日本語: 約300文字/分）
        estimated_duration_min = len(text) / 300
        speech_rate = word_count / max(estimated_duration_min, 0.1)
    
    # 2. フィラーワード出現率
    filler_count = 0
    for filler in FILLER_WORDS:
        filler_count += text.count(filler)
    
    filler_word_rate = filler_count / max(word_count, 1)
    
    # 3. 文の平均長さ
    sentences = re.split(r'[。！？\n]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if sentences:
        avg_sentence_length = sum(len(s) for s in sentences) / len(sentences)
    else:
        avg_sentence_length = 0.0
    
    # 4. 語彙多様性 (Type-Token Ratio: TTR)
    unique_words = set(words)
    vocabulary_diversity = len(unique_words) / max(word_count, 1)
    
    return {
        'speech_rate': round(speech_rate, 2),
        'filler_word_rate': round(filler_word_rate, 4),
        'avg_sentence_length': round(avg_sentence_length, 2),
        'vocabulary_diversity': round(vocabulary_diversity, 4)
    }

def get_speech_quality_score(analysis: dict) -> float:
    """
    話し方の質スコアを計算（0-1）
    
    評価基準:
    - 話す速度: 120-180 words/min が理想
    - フィラーワード率: 低いほど良い（< 0.05が理想）
    - 文の長さ: 15-30文字が理想
    - 語彙多様性: 高いほど良い（> 0.5が理想）
    """
    score = 0.0
    
    # 話す速度スコア
    speech_rate = analysis['speech_rate']
    if 120 <= speech_rate <= 180:
        speech_score = 1.0
    elif 100 <= speech_rate < 120 or 180 < speech_rate <= 200:
        speech_score = 0.8
    elif 80 <= speech_rate < 100 or 200 < speech_rate <= 220:
        speech_score = 0.6
    else:
        speech_score = 0.4
    
    # フィラーワードスコア
    filler_rate = analysis['filler_word_rate']
    if filler_rate < 0.05:
        filler_score = 1.0
    elif filler_rate < 0.1:
        filler_score = 0.8
    elif filler_rate < 0.15:
        filler_score = 0.6
    else:
        filler_score = 0.4
    
    # 文の長さスコア
    avg_length = analysis['avg_sentence_length']
    if 15 <= avg_length <= 30:
        length_score = 1.0
    elif 10 <= avg_length < 15 or 30 < avg_length <= 40:
        length_score = 0.8
    else:
        length_score = 0.6
    
    # 語彙多様性スコア
    diversity = analysis['vocabulary_diversity']
    if diversity >= 0.5:
        diversity_score = 1.0
    elif diversity >= 0.4:
        diversity_score = 0.8
    elif diversity >= 0.3:
        diversity_score = 0.6
    else:
        diversity_score = 0.4
    
    # 総合スコア（加重平均）
    score = (
        speech_score * 0.3 +
        filler_score * 0.3 +
        length_score * 0.2 +
        diversity_score * 0.2
    )
    
    return round(score, 2)

# 使用例
if __name__ == "__main__":
    sample_texts = [
        "今日は会議で新しいプロジェクトについて話し合いました。田中さんが来週までに企画書を作成することになりました。予算は500万円で、納期は3ヶ月後です。",
        "あー、えっと、その、なんか、まあ、ちょっと、やっぱり難しいと思うんですけど、あの、頑張ります。",
        "素晴らしい一日でした。友達と公園で遊んで、美味しいランチを食べて、映画を見て、夜は家族と団らん。最高の休日。"
    ]
    
    for i, text in enumerate(sample_texts, 1):
        print(f"\n=== Sample {i} ===")
        print(f"Text: {text[:50]}...")
        
        analysis = analyze_speech(text)
        print(f"Analysis: {analysis}")
        
        quality_score = get_speech_quality_score(analysis)
        print(f"Quality Score: {quality_score}")
