"""
アクションアイテム自動抽出
OpenAI Function Calling を使用してタスクを抽出
"""

import json
from datetime import datetime, timedelta

def extract_action_items(client, transcript_text):
    """
    文字起こしテキストからアクションアイテムを抽出
    
    Args:
        client: OpenAI client
        transcript_text: 文字起こしテキスト
        
    Returns:
        list: 抽出されたアクションアイテムのリスト
    """
    if not transcript_text or len(transcript_text.strip()) < 20:
        return []
    
    # Function calling の定義
    functions = [
        {
            "name": "extract_action_items",
            "description": "Extract action items, tasks, and to-dos from the transcript",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_items": {
                        "type": "array",
                        "description": "List of action items found in the text",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {
                                    "type": "string",
                                    "description": "Brief title of the action item"
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Detailed description of what needs to be done"
                                },
                                "priority": {
                                    "type": "string",
                                    "enum": ["low", "medium", "high", "urgent"],
                                    "description": "Priority level based on urgency and importance"
                                },
                                "due_date_offset": {
                                    "type": "integer",
                                    "description": "Number of days from now when this should be completed (null if not specified)"
                                }
                            },
                            "required": ["title", "priority"]
                        }
                    }
                },
                "required": ["action_items"]
            }
        }
    ]
    
    prompt = f"""以下の文字起こしテキストから、実行可能なアクションアイテム（タスク、TODO、やるべきこと）を抽出してください。

文字起こしテキスト:
{transcript_text}

以下のような表現を見つけてください：
- 「〜する」「〜しなければならない」「〜すべき」
- 「明日〜」「来週〜」「次回〜」
- 「忘れないように〜」「リマインダー〜」
- 「やること：〜」「TODO：〜」
- 具体的な行動を示す動詞（連絡、確認、作成、準備、etc）

優先度の判断基準：
- urgent: 緊急かつ重要（期限が迫っている、すぐに対応が必要）
- high: 重要だが緊急ではない（重要な目標に関連）
- medium: 通常のタスク（デフォルト）
- low: 緊急性も重要性も低い（いつかやりたいこと）

期限の推測：
- 「今日」「本日」→ 0日後
- 「明日」→ 1日後
- 「明後日」→ 2日後
- 「来週」→ 7日後
- 「再来週」→ 14日後
- 「来月」→ 30日後
- 期限の言及がない場合は null
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "あなたはアクションアイテムを抽出する専門家です。文字起こしテキストから実行可能なタスクを見つけ出します。"},
                {"role": "user", "content": prompt}
            ],
            functions=functions,
            function_call={"name": "extract_action_items"},
            temperature=0.3
        )
        
        # Function calling の結果を解析
        if response.choices[0].message.function_call:
            arguments = json.loads(response.choices[0].message.function_call.arguments)
            action_items = arguments.get("action_items", [])
            
            # due_date を計算
            for item in action_items:
                if "due_date_offset" in item and item["due_date_offset"] is not None:
                    due_date = datetime.now() + timedelta(days=item["due_date_offset"])
                    item["due_date"] = due_date.strftime("%Y-%m-%d")
                    del item["due_date_offset"]
                else:
                    item["due_date"] = None
            
            return action_items
        
        return []
        
    except Exception as e:
        print(f"[ACTION_EXTRACTOR] Error: {e}")
        return []


def save_action_items(db, entry_id, user_id, action_items):
    """
    抽出したアクションアイテムをDBに保存
    
    Args:
        db: MySQL connection
        entry_id: エントリID
        user_id: ユーザーID
        action_items: アクションアイテムのリスト
    """
    from ulid import ulid
    
    cursor = db.cursor()
    
    for item in action_items:
        public_id = ulid()
        title = item.get("title", "")
        description = item.get("description", "")
        priority = item.get("priority", "medium")
        due_date = item.get("due_date")
        
        cursor.execute("""
            INSERT INTO action_items 
            (entry_id, user_id, public_id, title, description, priority, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (entry_id, user_id, public_id, title, description, priority, due_date))
    
    db.commit()
    cursor.close()
    
    print(f"[ACTION_EXTRACTOR] Saved {len(action_items)} action items for entry {entry_id}")
