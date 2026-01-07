"""
Worker Main (Refactored)
Workerメインプロセスのリファクタリング版
"""

import json
import time
import signal
import sys
from app.settings import load_settings
from app.text_resources import load_text_resources
from app.storage import get_minio_client
from app.providers_openai import get_openai_client
from app.db import connect_mysql
import redis

from app.entry_processor import EntryProcessor
from app.jobs import process_range_summary, process_custom_summary, process_audio_enhancement

class Worker:
    """メインWorkerクラス"""
    
    def __init__(self):
        self.running = True
        self.settings = None
        self.resources = None
        self.redis_client = None
        self.db = None
        self.minio = None
        self.openai_client = None
        self.entry_processor = None
    
    def initialize(self):
        """初期化処理"""
        print("[WORKER] Initializing...")
        
        # 設定読み込み
        self.settings = load_settings()
        self.resources = load_text_resources(self.settings["resources_dir"])
        
        # Redis
        self.redis_client = redis.from_url(
            self.settings["redis_url"],
            decode_responses=True
        )
        
        # MySQL
        self.db = connect_mysql(
            self.settings["mysql_host"],
            self.settings["mysql_port"],
            self.settings["mysql_user"],
            self.settings["mysql_password"],
            self.settings["mysql_db"]
        )
        
        # MinIO
        self.minio = get_minio_client(
            self.settings["s3_endpoint"],
            self.settings["s3_access_key"],
            self.settings["s3_secret_key"]
        )
        
        # OpenAI
        self.openai_client = get_openai_client(self.settings["openai_api_key"])
        
        # Entry Processor
        self.entry_processor = EntryProcessor(
            self.db,
            self.redis_client,
            self.openai_client,
            self.minio,
            self.settings["s3_bucket"],
            self.resources,
            self.resources.get("ng_patterns", []),
            self.resources.get("non_save_word", [])
        )
        
        print("[WORKER] Initialization complete")
    
    def handle_job(self, job):
        """ジョブ処理ディスパッチャー"""
        job_type = job.get("type")
        
        try:
            if job_type == "PROCESS_ENTRY":
                entry_id = job["entryId"]
                print(f"[WORKER] Processing entry {entry_id}")
                self.entry_processor.process(entry_id)
            
            elif job_type == "PROCESS_RANGE_SUMMARY":
                summary_id = job["summaryId"]
                print(f"[WORKER] Processing range summary {summary_id}")
                process_range_summary(summary_id, self.db, self.openai_client)
            
            elif job_type == "CUSTOM_SUMMARY":
                entry_id = job["entryId"]
                options = job.get("options", {})
                print(f"[WORKER] Processing custom summary {entry_id}")
                process_custom_summary(entry_id, options, self.db, self.openai_client)
            
            elif job_type == "AUDIO_ENHANCEMENT":
                entry_id = job["entryId"]
                enhancement_type = job.get("enhancementType", "denoise")
                print(f"[WORKER] Processing audio enhancement {entry_id}")
                process_audio_enhancement(
                    entry_id, enhancement_type, self.db,
                    self.minio, self.settings["s3_bucket"]
                )
            
            else:
                print(f"[WORKER] Unknown job type: {job_type}")
        
        except Exception as e:
            print(f"[WORKER] Job failed: {e}")
    
    def run(self):
        """メインループ"""
        print("[WORKER] Starting main loop")
        
        while self.running:
            try:
                # ジョブ取得 (30秒タイムアウト)
                result = self.redis_client.brpop("jobs:default", timeout=30)
                
                if not result:
                    continue
                
                _, payload_str = result
                job = json.loads(payload_str)
                
                self.handle_job(job)
            
            except KeyboardInterrupt:
                print("[WORKER] Keyboard interrupt received")
                break
            
            except Exception as e:
                print(f"[WORKER] Main loop error: {e}")
                time.sleep(1)
    
    def shutdown(self):
        """シャットダウン処理"""
        print("[WORKER] Shutting down...")
        self.running = False
        
        if self.db:
            self.db.close()
        
        if self.redis_client:
            self.redis_client.close()
        
        print("[WORKER] Shutdown complete")

def signal_handler(signum, frame):
    """シグナルハンドラー"""
    print(f"\n[WORKER] Received signal {signum}")
    sys.exit(0)

def main():
    """メイン関数"""
    # シグナルハンドラ設定
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    worker = Worker()
    
    try:
        worker.initialize()
        worker.run()
    except Exception as e:
        print(f"[WORKER] Fatal error: {e}")
    finally:
        worker.shutdown()

if __name__ == "__main__":
    main()
