"""
Phase4対応のジョブ処理モジュール
追加機能: 感情分析、キーワード抽出、話し方分析、アクションアイテム抽出
"""

import re
import json
from datetime import datetime

# 既存モジュール
from app.providers_openai import stt_openai
from app.cleaner import clean_transcript
from app.summarizer import chat_summary
from app.pii_detector import detect_and_mask
from app.ng_detector import detect_ng_patterns
from app.tagger import extract_tags

# Phase4新規モジュール
from app.emotion_analyzer import analyze_emotion
from app.keyword_extractor import extract_keywords_and_topics
from app.speech_analyzer import analyze_speech_patterns
from app.action_extractor import extract_action_items, save_action_items
from app.custom_summarizer import generate_custom_summary
from app.audio_processor import enhance_audio

_BULLET_RE = re.compile(r'^[・•‣-]', re.MULTILINE)

def is_bullet_format_ok(text):
    if not text:
        return False
    return bool(_BULLET_RE.search(text))

def parse_audio_key(audio_url, bucket):
    prefix = f"s3://{bucket}/"
    if audio_url.startswith(prefix):
        return audio_url[len(prefix):]
    if audio_url.startswith("/"):
        return audio_url[1:]
    return audio_url

def detect_flags(text, ng_patterns, nonsave_patterns):
    flagged = 0
    flag_list = []
    if not text:
        return (flagged, flag_list)
    
    for pat in ng_patterns:
        if re.search(pat, text, re.IGNORECASE):
            flagged = 1
            if "ng_pattern" not in flag_list:
                flag_list.append("ng_pattern")
            break
    
    for pat in nonsave_patterns:
        if re.search(pat, text, re.IGNORECASE):
            flagged = 1
            if "non_save" not in flag_list:
                flag_list.append("non_save")
            break
    
    return (flagged, flag_list)

def process_entry(
    entry_id, r, db, minio, bucket, openai_client,
    resources, ng_patterns, nonsave_patterns
):
    """
    Phase4対応: 感情分析、キーワード抽出、話し方分析、アクションアイテム抽出を追加
    """
    from app.db import get_entry, update_entry, save_entry_tags, save_emotion_analysis, save_keywords, save_speech_metrics
    
    lock_key = f"lock:entry:{entry_id}"
    if not r.set(lock_key, "1", nx=True, ex=300):
        print(f"[PROCESS_ENTRY] Entry {entry_id} locked")
        return
    
    try:
        entry = get_entry(db, entry_id)
        if not entry:
            print(f"[PROCESS_ENTRY] Entry {entry_id} not found")
            return
        
        if entry.get("transcript_text"):
            print(f"[PROCESS_ENTRY] Entry {entry_id} already processed")
            return
        
        audio_url = entry["audio_url"]
        user_id = entry["user_id"]
        audio_key = parse_audio_key(audio_url, bucket)
        
        # 音声データ取得
        print(f"[PROCESS_ENTRY] Downloading {audio_key}")
        obj = minio.get_object(bucket, audio_key)
        audio_data = obj.read()
        obj.close()
        
        # STT
        print(f"[PROCESS_ENTRY] Transcribing {entry_id}")
        raw = stt_openai(openai_client, audio_data)
        cleaned = clean_transcript(raw, resources)
        
        # PII検出とマスク
        pii_detected, pii_types, masked = detect_and_mask(cleaned)
        pii_json = json.dumps(pii_types, ensure_ascii=False) if pii_types else None
        
        # NG検出
        ng_result = detect_ng_patterns(masked)
        old_flagged, old_flags = detect_flags(masked, ng_patterns, nonsave_patterns)
        
        content_flagged = 0
        flag_types = []
        
        # PIIがあれば先頭に挿入
        if pii_detected:
            content_flagged = 1
            flag_types.append("pii")
        
        # NGパターン
        if ng_result["flagged"]:
            content_flagged = 1
            flag_types.extend(ng_result["reasons"])
        
        if old_flagged:
            content_flagged = 1
            flag_types.extend(old_flags)
        
        flag_types = list(set(flag_types))
        flag_json = json.dumps(flag_types, ensure_ascii=False) if flag_types else None
        
        # 要約生成（content_flagged = 0 のみ）
        summ = None
        if masked and content_flagged == 0:
            print(f"[PROCESS_ENTRY] Summarizing {entry_id}")
            summ = chat_summary(openai_client, masked)
            if summ and not is_bullet_format_ok(summ):
                print(f"[PROCESS_ENTRY] Summary format invalid, retrying")
                summ = chat_summary(openai_client, masked)
        
        # DB更新
        update_entry(db, entry_id, masked, summ, pii_detected, pii_json, content_flagged, flag_json)
        
        # Phase4追加処理（content_flagged = 0 のみ）
        if masked and content_flagged == 0:
            # タグ抽出
            tags = extract_tags(openai_client, masked)
            if tags:
                save_entry_tags(db, entry_id, tags)
            
            # 感情分析
            emotion_result = analyze_emotion(openai_client, masked)
            if emotion_result:
                save_emotion_analysis(
                    db, entry_id,
                    emotion_result["primary_emotion"],
                    emotion_result["emotions"],
                    emotion_result["valence"],
                    emotion_result["arousal"],
                    emotion_result["dominance"]
                )
            
            # キーワード・トピック抽出
            keyword_result = extract_keywords_and_topics(openai_client, masked)
            if keyword_result:
                save_keywords(db, entry_id, keyword_result["keywords"], keyword_result["topics"])
            
            # 話し方分析
            speech_result = analyze_speech_patterns(masked)
            if speech_result:
                save_speech_metrics(
                    db, entry_id,
                    speech_result["words_per_minute"],
                    speech_result["pause_rate"],
                    speech_result["filler_words"],
                    speech_result["clarity_score"],
                    speech_result["confidence_level"]
                )
            
            # アクションアイテム抽出
            action_items = extract_action_items(openai_client, masked)
            if action_items:
                save_action_items(db, entry_id, user_id, action_items)
        
        print(f"[PROCESS_ENTRY] Entry {entry_id} done")
        
    finally:
        r.delete(lock_key)

def process_range_summary(summary_id, db, openai_client):
    """期間要約処理"""
    from app.db import (
        get_summary, claim_summary_processing, set_summary_done,
        set_summary_failed, collect_transcripts
    )
    
    summ = get_summary(db, summary_id)
    if not summ:
        print(f"[PROCESS_RANGE_SUMMARY] Summary {summary_id} not found")
        return
    
    if not claim_summary_processing(db, summary_id):
        print(f"[PROCESS_RANGE_SUMMARY] Summary {summary_id} already processing")
        return
    
    try:
        user_id = summ["user_id"]
        start = summ["range_start"]
        end = summ["range_end"]
        
        transcripts = collect_transcripts(db, user_id, start, end)
        
        if not transcripts:
            set_summary_failed(db, summary_id, "NO_DATA", "No entries in range")
            return
        
        combined = "\n\n".join(transcripts)
        summary_text = chat_summary(openai_client, combined)
        
        set_summary_done(db, summary_id, summary_text)
        print(f"[PROCESS_RANGE_SUMMARY] Summary {summary_id} done")
        
    except Exception as e:
        set_summary_failed(db, summary_id, "PROCESSING_ERROR", str(e))
        print(f"[PROCESS_RANGE_SUMMARY] Summary {summary_id} failed: {e}")

def process_custom_summary(entry_id, custom_options, db, openai_client):
    """カスタム要約再生成"""
    from app.db import get_entry, update_entry_summary
    
    entry = get_entry(db, entry_id)
    if not entry or not entry.get("transcript_text"):
        print(f"[CUSTOM_SUMMARY] Entry {entry_id} not found or no transcript")
        return
    
    transcript = entry["transcript_text"]
    
    try:
        custom_summary = generate_custom_summary(
            openai_client,
            transcript,
            custom_options.get("style", "bullet_points"),
            custom_options.get("length", "medium"),
            custom_options.get("focus"),
            custom_options.get("custom_prompt")
        )
        
        update_entry_summary(db, entry_id, custom_summary)
        print(f"[CUSTOM_SUMMARY] Entry {entry_id} custom summary done")
        
    except Exception as e:
        print(f"[CUSTOM_SUMMARY] Entry {entry_id} failed: {e}")

def process_audio_enhancement(entry_id, enhancement_type, db, minio, bucket):
    """音声品質向上処理"""
    from app.db import get_entry
    
    entry = get_entry(db, entry_id)
    if not entry:
        print(f"[AUDIO_ENHANCEMENT] Entry {entry_id} not found")
        return
    
    audio_url = entry["audio_url"]
    audio_key = parse_audio_key(audio_url, bucket)
    
    try:
        # 音声ダウンロード
        obj = minio.get_object(bucket, audio_key)
        audio_data = obj.read()
        obj.close()
        
        # 音声処理
        enhanced_data = enhance_audio(audio_data, enhancement_type)
        
        # 新しいキーでアップロード
        enhanced_key = audio_key.replace(".m4a", f"_{enhancement_type}.m4a")
        minio.put_object(
            bucket,
            enhanced_key,
            enhanced_data,
            len(enhanced_data),
            content_type="audio/m4a"
        )
        
        print(f"[AUDIO_ENHANCEMENT] Entry {entry_id} enhanced: {enhanced_key}")
        
    except Exception as e:
        print(f"[AUDIO_ENHANCEMENT] Entry {entry_id} failed: {e}")
