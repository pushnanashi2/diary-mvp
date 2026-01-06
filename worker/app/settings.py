import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    mysql_host: str
    mysql_port: int
    mysql_db: str
    mysql_user: str
    mysql_password: str
    redis_url: str
    s3_endpoint: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket: str
    openai_api_key: str
    resources_dir: str

def load_settings() -> Settings:
    return Settings(
        mysql_host=os.environ["MYSQL_HOST"],
        mysql_port=int(os.environ.get("MYSQL_PORT", "3306")),
        mysql_db=os.environ["MYSQL_DB"],
        mysql_user=os.environ["MYSQL_USER"],
        mysql_password=os.environ["MYSQL_PASSWORD"],
        redis_url=os.environ["REDIS_URL"],
        s3_endpoint=os.environ["S3_ENDPOINT"],
        s3_access_key=os.environ["S3_ACCESS_KEY"],
        s3_secret_key=os.environ["S3_SECRET_KEY"],
        s3_bucket=os.environ["S3_BUCKET"],
        openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
        resources_dir=os.environ.get("RESOURCES_DIR", "/app/resources"),
    )
