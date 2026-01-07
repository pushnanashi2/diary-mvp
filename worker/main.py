import json, time
import redis

from app.settings import load_settings
from app.text_resources import load_resources
from app.storage import make_minio
from app.providers_openai import make_client
from app.db import connect_mysql
from app.jobs import process_entry, process_range_summary, process_custom_summary

def main():
    s = load_settings()
    resources = load_resources(s.resources_dir)

    r = redis.from_url(s.redis_url, decode_responses=True)
    db = connect_mysql(s.mysql_host, s.mysql_port, s.mysql_user, s.mysql_password, s.mysql_db)
    minio = make_minio(s.s3_endpoint, s.s3_access_key, s.s3_secret_key)
    openai_client = make_client(s.openai_api_key)

    print("[worker] started (Phase4.1: custom summary support)", flush=True)

    while True:
        popped = r.brpop("jobs:default", timeout=30)
        if not popped:
            continue
        _, payload = popped
        job = json.loads(payload)
        t = job.get("type")

        try:
            if t == "PROCESS_ENTRY":
                process_entry(
                    r=r, db=db, minio=minio, bucket=s.s3_bucket,
                    openai_client=openai_client, resources=resources,
                    entry_id=int(job["entryId"])
                )
            elif t == "PROCESS_RANGE_SUMMARY":
                process_range_summary(
                    r=r, db=db, openai_client=openai_client, resources=resources,
                    summary_id=int(job["summaryId"])
                )
            elif t == "CUSTOM_SUMMARY":
                # Phase 4.1: カスタム要約ジョブ
                process_custom_summary(
                    r=r, db=db, openai_client=openai_client,
                    entry_id=int(job["entry_id"]),
                    style=job.get("style", "narrative"),
                    length=job.get("length", "medium"),
                    focus=job.get("focus", "key_points"),
                    custom_prompt=job.get("custom_prompt")
                )
        except Exception as e:
            print(f"[worker] job failed type={t} err={type(e).__name__}:{e}", flush=True)
            time.sleep(1)

if __name__ == "__main__":
    main()
