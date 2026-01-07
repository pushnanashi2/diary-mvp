"""
Database Module (MySQL)
Phase2: タグ保存 + 期間要約用クエリ追加
"""

import mysql.connector
import json

def connect_mysql(host, port, user, password, database):
    db = mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        connect_timeout=5,
        autocommit=True
    )
    return db

def get_entry(db, entry_id):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, user_id, audio_url, transcript_text, summary_text FROM entries WHERE id = %s",
        (entry_id,)
    )
    row = cursor.fetchone()
    cursor.close()
    return row

def update_entry(db, entry_id, transcript, summary, pii_detected, pii_types_json, content_flagged, flag_types_json):
    cursor = db.cursor()
    cursor.execute("""
        UPDATE entries
        SET transcript_text = %s,
            summary_text = %s,
            pii_detected = %s,
            pii_types = %s,
            content_flagged = %s,
            flag_types = %s,
            status = 'done',
            processed_at = NOW()
        WHERE id = %s
    """, (transcript, summary, pii_detected, pii_types_json, content_flagged, flag_types_json, entry_id))
    db.commit()
    cursor.close()

def update_entry_summary(db, entry_id, summary_text):
    """
    エントリの要約だけを更新（カスタム要約再生成用）
    """
    cursor = db.cursor()
    cursor.execute("""
        UPDATE entries
        SET summary_text = %s
        WHERE id = %s
    """, (summary_text, entry_id))
    db.commit()
    cursor.close()

def save_entry_tags(db, entry_id, tags):
    """Phase2追加: タグ保存"""
    if not tags:
        return
    cursor = db.cursor()
    for tag in tags:
        cursor.execute(
            "INSERT IGNORE INTO entry_tags (entry_id, tag) VALUES (%s, %s)",
            (entry_id, tag)
        )
    db.commit()
    cursor.close()

def get_summary(db, summary_id):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, user_id, range_start, range_end, status, template_id FROM summaries WHERE id = %s",
        (summary_id,)
    )
    row = cursor.fetchone()
    cursor.close()
    return row

def claim_summary_processing(db, summary_id):
    cursor = db.cursor()
    cursor.execute("""
        UPDATE summaries
        SET status = 'processing', started_at = NOW()
        WHERE id = %s AND status = 'queued'
    """, (summary_id,))
    db.commit()
    affected = cursor.rowcount
    cursor.close()
    return affected > 0

def set_summary_done(db, summary_id, summary_text):
    cursor = db.cursor()
    cursor.execute("""
        UPDATE summaries
        SET summary_text = %s, status = 'done', finished_at = NOW()
        WHERE id = %s
    """, (summary_text, summary_id))
    db.commit()
    cursor.close()

def set_summary_failed(db, summary_id, error_code, error_message):
    cursor = db.cursor()
    cursor.execute("""
        UPDATE summaries
        SET status = 'failed',
            error_code = %s,
            error_message = %s,
            finished_at = NOW()
        WHERE id = %s
    """, (error_code, error_message, summary_id))
    db.commit()
    cursor.close()

def collect_transcripts(db, user_id, start, end):
    """
    指定期間のエントリのtranscriptを取得（content_flagged = 0 のみ）
    期間要約時、content_flagged=0 は AI に渡す（PII あり除外）
    """
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT transcript_text
        FROM entries
        WHERE user_id = %s
          AND DATE(created_at) BETWEEN %s AND %s
          AND transcript_text IS NOT NULL
          AND content_flagged = 0
        ORDER BY created_at ASC
    """, (user_id, start, end))
    rows = cursor.fetchall()
    cursor.close()
    return [r['transcript_text'] for r in rows]

def save_emotion_analysis(db, entry_id, primary_emotion, emotions, valence, arousal, dominance):
    """感情分析結果を保存"""
    cursor = db.cursor()
    emotions_json = json.dumps(emotions, ensure_ascii=False)
    cursor.execute("""
        INSERT INTO emotion_analysis
        (entry_id, primary_emotion, emotions, valence, arousal, dominance)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        primary_emotion = VALUES(primary_emotion),
        emotions = VALUES(emotions),
        valence = VALUES(valence),
        arousal = VALUES(arousal),
        dominance = VALUES(dominance)
    """, (entry_id, primary_emotion, emotions_json, valence, arousal, dominance))
    db.commit()
    cursor.close()

def save_keywords(db, entry_id, keywords, topics):
    """キーワード・トピック抽出結果を保存"""
    cursor = db.cursor()
    keywords_json = json.dumps(keywords, ensure_ascii=False)
    topics_json = json.dumps(topics, ensure_ascii=False)
    cursor.execute("""
        INSERT INTO keyword_analysis
        (entry_id, keywords, topics)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
        keywords = VALUES(keywords),
        topics = VALUES(topics)
    """, (entry_id, keywords_json, topics_json))
    db.commit()
    cursor.close()

def save_speech_metrics(db, entry_id, wpm, pause_rate, filler_words, clarity_score, confidence_level):
    """話し方分析結果を保存"""
    cursor = db.cursor()
    filler_json = json.dumps(filler_words, ensure_ascii=False)
    cursor.execute("""
        INSERT INTO speech_metrics
        (entry_id, words_per_minute, pause_rate, filler_words, clarity_score, confidence_level)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        words_per_minute = VALUES(words_per_minute),
        pause_rate = VALUES(pause_rate),
        filler_words = VALUES(filler_words),
        clarity_score = VALUES(clarity_score),
        confidence_level = VALUES(confidence_level)
    """, (entry_id, wpm, pause_rate, filler_json, clarity_score, confidence_level))
    db.commit()
    cursor.close()
