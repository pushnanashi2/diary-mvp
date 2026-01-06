import json, re
from .locks import acquire_lock
from .storage import get_object_bytes
from .cleaners import clean_transcript
from .providers_openai import stt as stt_openai, chat_summary
from .pii import detect_and_mask
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
    t = text or ""
    types = []
    if any(p.search(t) for p in ng_patterns):
        types.append("ng_topic")
    if any(p.search(t) for p in nonsave_patterns):
        types.append("non_save_word")
    return types

def process_entry(*, r, db, minio, bucket: str, openai_client, resources, entry_id: int):
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

    # NG検出（マスク後テキストに対して）
    flag_types = detect_flags(masked, resources.ng_topic_patterns, resources.non_save_patterns)

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

def process_range_summary(*, r, db, openai_client, resources, summary_id: int):
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
