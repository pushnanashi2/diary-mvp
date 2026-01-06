import os, json, time, re, io
import redis
import mysql.connector
from minio import Minio
from openai import OpenAI

r = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)

def connect_mysql():
    while True:
        try:
            db = mysql.connector.connect(
                host=os.environ["MYSQL_HOST"],
                port=int(os.environ.get("MYSQL_PORT", "3306")),
                user=os.environ["MYSQL_USER"],
                password=os.environ["MYSQL_PASSWORD"],
                database=os.environ["MYSQL_DB"],
                connection_timeout=5,
            )
            db.autocommit = True
            return db
        except Exception as e:
            print(f"[worker] waiting mysql... {type(e).__name__}:{e}", flush=True)
            time.sleep(1)

db = connect_mysql()

S3_ENDPOINT = os.environ["S3_ENDPOINT"]
S3_ACCESS_KEY = os.environ["S3_ACCESS_KEY"]
S3_SECRET_KEY = os.environ["S3_SECRET_KEY"]
S3_BUCKET = os.environ["S3_BUCKET"]

endpoint = S3_ENDPOINT.replace("http://", "").replace("https://", "")
host, port = (endpoint.split(":") + ["9000"])[:2]
minio = Minio(
    f"{host}:{port}",
    access_key=S3_ACCESS_KEY,
    secret_key=S3_SECRET_KEY,
    secure=S3_ENDPOINT.startswith("https://"),
)

openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"), timeout=90.0, max_retries=0)

def lock(key: str, ttl_sec: int = 600) -> bool:
    # NXでロック、落ちても自動解除
    return bool(r.set(key, "1", nx=True, ex=ttl_sec))

def clean_transcript_ja(text: str) -> str:
    fillers = [r"あー+", r"えー+", r"えっと+", r"えーっと+", r"うーん+", r"んー+", r"そのー+", r"なんか"]
    t = text or ""
    for f in fillers:
        t = re.sub(f, "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def stt(audio_bytes: bytes, filename: str) -> str:
    f = io.BytesIO(audio_bytes)
    f.name = filename
    resp = openai_client.audio.transcriptions.create(model="whisper-1", file=f)
    return resp.text

def summarize(text: str) -> str:
    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":"日記を簡潔に要約。個人情報は不要に詳細化しない。"},
            {"role":"user","content":f"次の内容を日本語で3〜5行で要約:\n\n{text}"}
        ],
        temperature=0.3
    )
    return resp.choices[0].message.content.strip()

def parse_audio_url(url: str):
    marker = f"/{S3_BUCKET}/"
    idx = url.find(marker)
    if idx == -1:
        raise ValueError("cannot parse audio_url")
    key = url[idx + len(marker):]
    return S3_BUCKET, key

def process_entry(entry_id: int):
    if not lock(f"lock:entry:{entry_id}", 600):
        return

    cur = db.cursor(dictionary=True)
    cur.execute("SELECT id, audio_url, transcript_text, summary_text FROM entries WHERE id=%s", (entry_id,))
    e = cur.fetchone()
    if not e:
        return

    # 既に処理済みならスキップ（再処理したい場合は後で専用APIを作る）
    if e.get("transcript_text") and e.get("summary_text"):
        return

    bucket, key = parse_audio_url(e["audio_url"])
    obj = minio.get_object(bucket, key)
    audio_bytes = obj.read()

    raw = stt(audio_bytes, filename=key.split("/")[-1])
    cleaned = clean_transcript_ja(raw)
    summ = summarize(cleaned) if cleaned else None

    cur.execute(
        "UPDATE entries SET transcript_text=%s, summary_text=%s WHERE id=%s",
        (cleaned, summ, entry_id)
    )

def set_failed(cur, summary_id: int, code: str, msg: str):
    cur.execute(
        "UPDATE summaries SET status='failed', error_code=%s, error_message=%s, finished_at=NOW() WHERE id=%s",
        (code, msg[:255], summary_id)
    )

def process_range_summary(summary_id: int):
    if not lock(f"lock:summary:{summary_id}", 1200):
        return

    cur = db.cursor(dictionary=True)

    # ここで“処理権限”を奪い合う：queuedの時だけprocessingにする
    cur.execute(
        "UPDATE summaries SET status='processing', error_code=NULL, error_message=NULL, started_at=NOW(), finished_at=NULL WHERE id=%s AND status='queued'",
        (summary_id,)
    )
    if cur.rowcount == 0:
        return  # 既に別workerが処理中 or done/failed

    try:
        cur.execute("SELECT id, user_id, range_start, range_end FROM summaries WHERE id=%s", (summary_id,))
        sm = cur.fetchone()
        if not sm:
            return

        cur.execute(
            """
            SELECT transcript_text FROM entries
            WHERE user_id=%s AND created_at >= %s AND created_at <= %s AND transcript_text IS NOT NULL
            ORDER BY created_at ASC
            """,
            (sm["user_id"], sm["range_start"], sm["range_end"])
        )
        texts = [row["transcript_text"] for row in cur.fetchall() if row["transcript_text"]]
        combined = "\n\n".join(texts).strip()

        if not combined:
            out = "対象期間にテキスト化された日記がありません。"
        else:
            out = summarize(combined[:20000])

        cur.execute("UPDATE summaries SET summary_text=%s, status='done', finished_at=NOW() WHERE id=%s", (out, summary_id))

    except Exception as e:
        set_failed(cur, summary_id, type(e).__name__, f"{type(e).__name__}:{e}")
        raise

def main():
    print("[worker] started", flush=True)
    while True:
        popped = r.brpop("jobs:default", timeout=30)
        if not popped:
            continue
        _, payload = popped
        job = json.loads(payload)
        t = job.get("type")
        try:
            if t == "PROCESS_ENTRY":
                process_entry(int(job["entryId"]))
            elif t == "PROCESS_RANGE_SUMMARY":
                process_range_summary(int(job["summaryId"]))
        except Exception as e:
            print(f"[worker] job failed type={t} err={type(e).__name__}:{e}", flush=True)
            time.sleep(1)

if __name__ == "__main__":
    main()
