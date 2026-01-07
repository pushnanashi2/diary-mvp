"""
Phase4対応 Workerメイン
Custom Summary、Audio Enhancement ジョブ追加
"""

import json
import time
from app.settings import load_settings
from app.text_resources import load_text_resources
from app.storage import get_minio_client
from app.providers_openai import get_openai_client
from app.db import connect_mysql
import redis

from app.jobs import process_entry, process_range_summary, process_custom_summary, process_audio_enhancement

def main():
    settings = load_settings()
    resources = load_text_resources(settings["resources_dir"])
    
    # Redis
    r = redis.from_url(settings["redis_url"], decode_responses=True)
    
    # MySQL
    db = connect_mysql(
        settings["mysql_host"],
        settings["mysql_port"],
        settings["mysql_user"],
        settings["mysql_password"],
        settings["mysql_db"]
    )
    
    # MinIO
    minio = get_minio_client(
        settings["s3_endpoint"],
        settings["s3_access_key"],
        settings["s3_secret_key"]
    )
    bucket = settings["s3_bucket"]
    
    # OpenAI
    openai_client = get_openai_client(settings["openai_api_key"])
    
    ng_patterns = resources.get("ng_patterns", [])
    nonsave_patterns = resources.get("non_save_word", [])
    
    print("[WORKER] Phase4 Worker started")
    
    while True:
        try:
            result = r.brpop("jobs:default", timeout=30)
            if not result:
                continue
            
            _, payload_str = result
            job = json.loads(payload_str)
            job_type = job.get("type")
            
            if job_type == "PROCESS_ENTRY":
                entry_id = job["entryId"]
                print(f"[WORKER] Processing entry {entry_id}")
                process_entry(
                    entry_id, r, db, minio, bucket, openai_client,
                    resources, ng_patterns, nonsave_patterns
                )
            
            elif job_type == "PROCESS_RANGE_SUMMARY":
                summary_id = job["summaryId"]
                print(f"[WORKER] Processing summary {summary_id}")
                process_range_summary(summary_id, db, openai_client)
            
            elif job_type == "CUSTOM_SUMMARY":
                entry_id = job["entryId"]
                custom_options = job.get("options", {})
                print(f"[WORKER] Processing custom summary for entry {entry_id}")
                process_custom_summary(entry_id, custom_options, db, openai_client)
            
            elif job_type == "AUDIO_ENHANCEMENT":
                entry_id = job["entryId"]
                enhancement_type = job.get("enhancementType", "denoise")
                print(f"[WORKER] Processing audio enhancement for entry {entry_id}")
                process_audio_enhancement(entry_id, enhancement_type, db, minio, bucket)
            
            else:
                print(f"[WORKER] Unknown job type: {job_type}")
            
        except Exception as e:
            print(f"[WORKER] Job failed: {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()
