"""
ジョブ処理モジュール（Phase4.1対応版）

Phase2追加機能:
- タグ自動抽出（tagger.py）
- NG検出強化（ng_detector.py）

Phase4.1追加機能:
- カスタム要約再生成（custom_summarizer.py）
"""

import json, re
from .locks import acquire_lock
from .storage import get_object_bytes
from .cleaners import clean_transcript
from .providers_openai import stt as stt_openai, chat_summary
from .pii import detect_and_mask
from .tagger import extract_tags  # Phase2-2
from .ng_detector import detect_ng  # Phase2-3
from .custom_summarizer import generate_custom_summary  # Phase4.1
from . import db as dbm

def parse_audio_key(audio_url: str, bucket: str) -> str:
    marker = f"/{bucket}/"
    idx = audio_url.find(marker)
    if idx == -1:
        raise ValueError("cannot parse audio_url")
    return audio_url[idx + len(marker):]

_BULLET_RE = re.compile(
    r'^【重要トピック】\n'
    r'(- .+\n){3,7}'
    r'\n'
    r'【次にやること】\n'
    r'(- .+\n){1,3}$',
    re.M
)

def is_bullet_format_ok(text: str) -> bool:
    t = (text or "").strip()
    if not t.endswith("\n"):
        t += "\n"
    return _BULLET_RE.match(t) is not None

def detect_flags(text: str, ng_patterns, nonsave_patterns) -> list[str]:
    """
    旧版のNG検出（後方互換）
    Phase2-3でng_detector.pyに移行したが、resources経由の検出も残す
    """
    t = text or ""
    types = []
    if any(p.search(t) for p in ng_patterns):
        types.append("ng_topic")
    if any(p.search(t) for p in nonsave_patterns):
        types.append("non_save_word")
    return types

def process_entry(*, r, db, minio, bucket: str, openai_client, resources, entry_id: int):
    """
    エントリ処理（Phase2対応版）
    
    追加機能:
    1. タグ自動抽出（transcript_textから）
    2. NG検出強化（ng_detector.py使用）
    """
    if not acquire_lock(r, f"lock:entry:{entry_id}", ttl_sec=600):
        return

    e = dbm.get_entry(db, entry_id)
    if not e:
        return

    # 既に処理済みならスキップ
    if e.get("transcript_text") is not None and e.get("summary_text") is not None:
        return

    key = parse_audio_key(e["audio_url"], bucket)
    audio_bytes = get_object_bytes(minio, bucket, key)

    raw = stt_openai(openai_client, audio_bytes, filename=key.split("/")[-1])
    cleaned = clean_transcript(raw, resources.filler_patterns)

    # PII検出＆マスク（保存はマスク後のみ）
    pii = detect_and_mask(cleaned, resources.pii_email_patterns, resources.pii_phone_patterns)
    masked = pii.masked_text
    pii_detected = 1 if pii.types else 0
    pii_types_json = json.dumps(pii.types, ensure_ascii=False) if pii.types else None

    # Phase2-3: NG検出強化（ng_detector.py使用）
    ng_result = detect_ng(masked)
    flag_types = ng_result['ng_types'].copy() if ng_result['is_ng'] else []
    
    # 旧版のNG検出も併用（resources経由）
    old_flags = detect_flags(masked, resources.ng_topic_patterns, resources.non_save_patterns)
    for f in old_flags:
        if f not in flag_types:
            flag_types.append(f)

    # 重要：PIIが出たら、それだけでAIブロック対象
    if pii_detected == 1:
        if "pii" not in flag_types:
            flag_types.insert(0, "pii")

    content_flagged = 1 if flag_types else 0
    flag_types_json = json.dumps(flag_types, ensure_ascii=False) if flag_types else None

    # 重要：flaggedなら要約を作らない（LLMに渡さない）
    summ = None
    if masked and content_flagged == 0:
        user = resources.entry_summary_user_tpl.replace("{TEXT}", masked)
        summ = chat_summary(openai_client, resources.entry_summary_system, user)

    # DB更新
    dbm.update_entry(
        db,
        entry_id,
        masked,
        summ,
        pii_detected,
        pii_types_json,
        content_flagged,
        flag_types_json,
    )
    
    # Phase2-2: タグ抽出＆保存
    if masked and content_flagged == 0:
        tags = extract_tags(masked)
        if tags:
            dbm.save_entry_tags(db, entry_id, tags)
            print(f"[process_entry] Entry {entry_id} tags: {tags}")

def process_range_summary(*, r, db, openai_client, resources, summary_id: int):
    """
    期間要約処理
    
    変更なし（Phase2では変更不要）
    """
    if not dbm.claim_summary_processing(db, summary_id):
        return

    try:
        sm = dbm.get_summary(db, summary_id)
        if not sm:
            return

        template_id = sm.get("template_id") or "default"
        tpl = resources.range_summary_user_templates.get(template_id) or resources.range_summary_user_templates["default"]

        # collect_transcripts側で content_flagged=0 のみ取得する実装前提（AIに伝わらない）
        texts = dbm.collect_transcripts(db, sm["user_id"], sm["range_start"], sm["range_end"])
        combined = "\n\n".join(texts).strip()

        if not combined:
            out = "対象期間にテキスト化された日記がありません。"
        else:
            user = tpl.replace("{TEXT}", combined[:20000])
            out = chat_summary(openai_client, None, user)

        if template_id == "bullet" and not is_bullet_format_ok(out):
            dbm.set_summary_failed(db, summary_id, "TEMPLATE_MISMATCH", "bullet format mismatch")
            return

        dbm.set_summary_done(db, summary_id, out)

    except Exception as e:
        dbm.set_summary_failed(db, summary_id, type(e).__name__, f"{type(e).__name__}:{e}")
        raise

def process_custom_summary(*, r, db, openai_client, entry_id: int, style: str, length: str, focus: str, custom_prompt: str = None):
    """
    Phase 4.1: カスタム要約再生成
    
    Args:
        entry_id: エントリID
        style: 要約スタイル (bullet_points, narrative, concise, detailed)
        length: 要約の長さ (short, medium, long)
        focus: フォーカスポイント (action_items, key_points, emotions, events, insights)
        custom_prompt: ユーザー指定のカスタムプロンプト（オプション）
    """
    if not acquire_lock(r, f"lock:custom_summary:{entry_id}", ttl_sec=300):
        return

    try:
        e = dbm.get_entry(db, entry_id)
        if not e:
            print(f"[process_custom_summary] Entry {entry_id} not found")
            return
        
        transcript_text = e.get("transcript_text")
        if not transcript_text:
            print(f"[process_custom_summary] Entry {entry_id} has no transcript")
            return
        
        # content_flaggedの場合はスキップ
        if e.get("content_flagged", 0) == 1:
            print(f"[process_custom_summary] Entry {entry_id} is flagged, skipping")
            return
        
        # カスタム要約生成
        custom_summary = generate_custom_summary(
            transcript_text,
            style=style,
            length=length,
            focus=focus,
            custom_prompt=custom_prompt
        )
        
        # summary_textフィールドを上書き更新
        dbm.update_entry_summary(db, entry_id, custom_summary)
        
        print(f"[process_custom_summary] Entry {entry_id} custom summary generated: style={style}, length={length}, focus={focus}")
        
    except Exception as e:
        print(f"[process_custom_summary] Error processing entry {entry_id}: {type(e).__name__}: {e}")
        raise
