"""
データベース操作モジュール（Phase2対応版）

Phase2追加:
- save_entry_tags(): タグ保存機能
"""

import time
import mysql.connector

def connect_mysql(host: str, port: int, user: str, password: str, database: str):
    while True:
        try:
            db = mysql.connector.connect(
                host=host, port=port, user=user, password=password, database=database,
                connection_timeout=5,
            )
            db.autocommit = True
            return db
        except Exception as e:
            print(f"[worker] waiting mysql... {type(e).__name__}:{e}", flush=True)
            time.sleep(1)

def get_entry(db, entry_id: int):
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT id, audio_url, transcript_text, summary_text FROM entries WHERE id=%s", (entry_id,))
    return cur.fetchone()

def update_entry(db, entry_id: int, transcript: str, summary: str | None,
                 pii_detected: int, pii_types_json: str | None,
                 content_flagged: int, flag_types_json: str | None):
    cur = db.cursor()
    cur.execute(
        "UPDATE entries SET transcript_text=%s, summary_text=%s, pii_detected=%s, pii_types=%s, content_flagged=%s, flag_types=%s WHERE id=%s",
        (transcript, summary, pii_detected, pii_types_json, content_flagged, flag_types_json, entry_id)
    )

def save_entry_tags(db, entry_id: int, tags: list[str]):
    """
    エントリのタグを保存（Phase2-2）
    
    Args:
        db: データベース接続
        entry_id: エントリID
        tags: タグのリスト（例: ['#天気', '#友人']）
    """
    if not tags:
        return
    
    cur = db.cursor()
    for tag in tags:
        try:
            # INSERT IGNORE で重複を無視
            cur.execute(
                "INSERT IGNORE INTO entry_tags(entry_id, tag) VALUES (%s, %s)",
                (entry_id, tag)
            )
        except Exception as e:
            print(f"[save_entry_tags] Failed to insert tag {tag} for entry {entry_id}: {e}")

def get_summary(db, summary_id: int):
    cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT id, user_id, range_start, range_end, status, template_id FROM summaries WHERE id=%s",
        (summary_id,)
    )
    return cur.fetchone()

def claim_summary_processing(db, summary_id: int) -> bool:
    cur = db.cursor()
    cur.execute(
        "UPDATE summaries SET status='processing', error_code=NULL, error_message=NULL, started_at=NOW(), finished_at=NULL "
        "WHERE id=%s AND status='queued'",
        (summary_id,)
    )
    return cur.rowcount == 1

def set_summary_done(db, summary_id: int, summary_text: str):
    cur = db.cursor()
    cur.execute(
        "UPDATE summaries SET summary_text=%s, status='done', finished_at=NOW() WHERE id=%s",
        (summary_text, summary_id)
    )

def set_summary_failed(db, summary_id: int, code: str, msg: str):
    cur = db.cursor()
    cur.execute(
        "UPDATE summaries SET status='failed', error_code=%s, error_message=%s, finished_at=NOW() WHERE id=%s",
        (code, msg[:255], summary_id)
    )

def collect_transcripts(db, user_id: int, start, end) -> list[str]:
    cur = db.cursor(dictionary=True)
    # 重要：content_flagged=0 のみを期間要約に含める（AIに伝えない）
    cur.execute(
        """
        SELECT transcript_text FROM entries
        WHERE user_id=%s
          AND created_at >= %s AND created_at <= %s
          AND transcript_text IS NOT NULL
          AND content_flagged = 0
        ORDER BY created_at ASC
        """,
        (user_id, start, end)
    )
    return [r["transcript_text"] for r in cur.fetchall() if r.get("transcript_text")]
