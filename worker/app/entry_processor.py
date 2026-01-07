"""
Entry Processor (Refactored)
エントリー処理のリファクタリング版
"""

import json
from app.base_processor import BaseProcessor
from app.providers_openai import stt_openai
from app.cleaner import clean_transcript
from app.summarizer import chat_summary
from app.pii_detector import detect_and_mask
from app.ng_detector import detect_ng_patterns
from app.tagger import extract_tags
from app.emotion_analyzer import analyze_emotion
from app.keyword_extractor import extract_keywords_and_topics
from app.speech_analyzer import analyze_speech_patterns
from app.action_extractor import extract_action_items, save_action_items

class EntryProcessor(BaseProcessor):
    """エントリー処理クラス"""
    
    def __init__(self, db, redis_client, openai_client, minio_client, bucket, resources, ng_patterns, nonsave_patterns):
        super().__init__(db, redis_client, openai_client)
        self.minio = minio_client
        self.bucket = bucket
        self.resources = resources
        self.ng_patterns = ng_patterns
        self.nonsave_patterns = nonsave_patterns
    
    def process(self, entry_id):
        """エントリーを処理"""
        lock_key = f"lock:entry:{entry_id}"
        
        if not self.acquire_lock(lock_key):
            self.log_info(f"Entry {entry_id} is locked, skipping")
            return
        
        try:
            self._process_entry(entry_id)
        except Exception as e:
            self.log_error(f"Failed to process entry {entry_id}", e)
        finally:
            self.release_lock(lock_key)
    
    def _process_entry(self, entry_id):
        """内部処理ロジック"""
        from app.db import get_entry, update_entry, save_entry_tags
        from app.db import save_emotion_analysis, save_keywords, save_speech_metrics
        
        # エントリー取得
        entry = get_entry(self.db, entry_id)
        if not entry:
            self.log_error(f"Entry {entry_id} not found")
            return
        
        if entry.get("transcript_text"):
            self.log_info(f"Entry {entry_id} already processed")
            return
        
        user_id = entry["user_id"]
        audio_url = entry["audio_url"]
        audio_key = self._parse_audio_key(audio_url)
        
        # 音声データ取得
        self.log_info(f"Downloading audio: {audio_key}")
        audio_data = self._download_audio(audio_key)
        
        # STT
        self.log_info(f"Transcribing entry {entry_id}")
        raw_transcript = stt_openai(self.openai_client, audio_data)
        cleaned_transcript = clean_transcript(raw_transcript, self.resources)
        
        # PII検出とマスク
        pii_detected, pii_types, masked_text = detect_and_mask(cleaned_transcript)
        
        # NG検出
        ng_result = detect_ng_patterns(masked_text)
        
        # フラグ判定
        content_flagged, flag_types = self._determine_flags(
            pii_detected, ng_result, masked_text
        )
        
        # 要約生成（フラグなしのみ）
        summary = None
        if masked_text and content_flagged == 0:
            self.log_info(f"Generating summary for entry {entry_id}")
            summary = chat_summary(self.openai_client, masked_text)
        
        # DB更新
        pii_json = self.safe_json_dumps(pii_types) if pii_types else None
        flag_json = self.safe_json_dumps(flag_types) if flag_types else None
        
        update_entry(
            self.db, entry_id, masked_text, summary,
            pii_detected, pii_json, content_flagged, flag_json
        )
        
        # 拡張分析（フラグなしのみ）
        if masked_text and content_flagged == 0:
            self._perform_extended_analysis(entry_id, user_id, masked_text)
        
        self.log_info(f"Entry {entry_id} processed successfully")
    
    def _parse_audio_key(self, audio_url):
        """音声URLからキーを抽出"""
        prefix = f"s3://{self.bucket}/"
        if audio_url.startswith(prefix):
            return audio_url[len(prefix):]
        return audio_url.lstrip("/")
    
    def _download_audio(self, audio_key):
        """音声データをダウンロード"""
        obj = self.minio.get_object(self.bucket, audio_key)
        data = obj.read()
        obj.close()
        return data
    
    def _determine_flags(self, pii_detected, ng_result, text):
        """コンテンツフラグを判定"""
        flag_types = []
        
        if pii_detected:
            flag_types.append("pii")
        
        if ng_result["flagged"]:
            flag_types.extend(ng_result["reasons"])
        
        # 重複除去
        flag_types = list(set(flag_types))
        content_flagged = 1 if flag_types else 0
        
        return content_flagged, flag_types
    
    def _perform_extended_analysis(self, entry_id, user_id, text):
        """拡張分析を実行"""
        from app.db import save_entry_tags, save_emotion_analysis
        from app.db import save_keywords, save_speech_metrics
        
        # タグ抽出
        tags = extract_tags(self.openai_client, text)
        if tags:
            save_entry_tags(self.db, entry_id, tags)
        
        # 感情分析
        emotion = analyze_emotion(self.openai_client, text)
        if emotion:
            save_emotion_analysis(
                self.db, entry_id,
                emotion["primary_emotion"], emotion["emotions"],
                emotion["valence"], emotion["arousal"], emotion["dominance"]
            )
        
        # キーワード抽出
        keywords = extract_keywords_and_topics(self.openai_client, text)
        if keywords:
            save_keywords(self.db, entry_id, keywords["keywords"], keywords["topics"])
        
        # 話し方分析
        speech = analyze_speech_patterns(text)
        if speech:
            save_speech_metrics(
                self.db, entry_id,
                speech["words_per_minute"], speech["pause_rate"],
                speech["filler_words"], speech["clarity_score"], speech["confidence_level"]
            )
        
        # アクションアイテム抽出
        actions = extract_action_items(self.openai_client, text)
        if actions:
            save_action_items(self.db, entry_id, user_id, actions)
