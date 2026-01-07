"""
Phase 4.1: カスタム要約生成
スタイル・長さ・フォーカスに応じてプロンプトをカスタマイズ
"""

from chat import generate_summary

# スタイル別プロンプトテンプレート
STYLE_TEMPLATES = {
    'bullet_points': """
以下のテキストを箇条書き（bullet points）形式で要約してください。
各ポイントは1-2文で簡潔にまとめてください。
""",
    'narrative': """
以下のテキストを物語形式（narrative）で要約してください。
時系列に沿って、自然な文章で記述してください。
""",
    'concise': """
以下のテキストを非常に簡潔に要約してください。
最も重要な情報のみを抽出し、3文以内でまとめてください。
""",
    'detailed': """
以下のテキストを詳細に要約してください。
背景情報、詳細、および文脈を含めて記述してください。
"""
}

# 長さ別ガイドライン
LENGTH_GUIDELINES = {
    'short': "100文字以内で要約してください。",
    'medium': "200-300文字で要約してください。",
    'long': "400-500文字で詳細に要約してください。"
}

# フォーカス別プロンプト
FOCUS_PROMPTS = {
    'action_items': """
特にアクションアイテム（やるべきこと、TODO）に焦点を当ててください。
誰が何をいつまでにやるべきかを明確にしてください。
""",
    'key_points': """
主要なポイント（key points）に焦点を当ててください。
最も重要な情報や決定事項を強調してください。
""",
    'emotions': """
感情的な側面に焦点を当ててください。
話者の気持ちや感情の変化を捉えてください。
""",
    'events': """
出来事（events）に焦点を当ててください。
何が起きたのか、時系列で整理してください。
""",
    'insights': """
洞察（insights）や気づきに焦点を当ててください。
深い理解や学びを抽出してください。
"""
}

def build_custom_prompt(transcript_text, style='narrative', length='medium', focus='key_points', custom_prompt=None):
    """
    カスタム要約プロンプトを構築
    """
    if custom_prompt:
        # ユーザー指定のカスタムプロンプトを優先
        prompt = f"{custom_prompt}\n\n【テキスト】\n{transcript_text}"
        return prompt
    
    # デフォルトプロンプト構築
    style_instruction = STYLE_TEMPLATES.get(style, STYLE_TEMPLATES['narrative'])
    length_guideline = LENGTH_GUIDELINES.get(length, LENGTH_GUIDELINES['medium'])
    focus_instruction = FOCUS_PROMPTS.get(focus, FOCUS_PROMPTS['key_points'])
    
    prompt = f"""
{style_instruction}

{length_guideline}

{focus_instruction}

【テキスト】
{transcript_text}

【要約】
"""
    return prompt

def generate_custom_summary(transcript_text, style='narrative', length='medium', focus='key_points', custom_prompt=None):
    """
    カスタム要約を生成
    
    Args:
        transcript_text: 文字起こしテキスト
        style: 要約スタイル (bullet_points, narrative, concise, detailed)
        length: 要約の長さ (short, medium, long)
        focus: フォーカスポイント (action_items, key_points, emotions, events, insights)
        custom_prompt: ユーザー指定のカスタムプロンプト（オプション）
    
    Returns:
        要約テキスト
    """
    prompt = build_custom_prompt(transcript_text, style, length, focus, custom_prompt)
    summary = generate_summary(prompt)
    return summary

# 使用例
if __name__ == "__main__":
    sample_text = """
    今日は会議で新しいプロジェクトについて話し合いました。
    田中さんが来週までに企画書を作成することになりました。
    予算は500万円で、納期は3ヶ月後です。
    みんな少し不安そうでしたが、頑張ろうという雰囲気でした。
    """
    
    # スタイル別テスト
    print("=== Bullet Points ===")
    print(generate_custom_summary(sample_text, style='bullet_points', length='short'))
    
    print("\n=== Narrative ===")
    print(generate_custom_summary(sample_text, style='narrative', length='medium'))
    
    print("\n=== Action Items Focus ===")
    print(generate_custom_summary(sample_text, style='bullet_points', focus='action_items'))
    
    print("\n=== Emotions Focus ===")
    print(generate_custom_summary(sample_text, style='narrative', focus='emotions'))
