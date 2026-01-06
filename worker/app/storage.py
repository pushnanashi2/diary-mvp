from minio import Minio

def make_minio(endpoint: str, access_key: str, secret_key: str) -> Minio:
    endpoint2 = endpoint.replace("http://", "").replace("https://", "")
    host, port = (endpoint2.split(":") + ["9000"])[:2]
    return Minio(
        f"{host}:{port}",
        access_key=access_key,
        secret_key=secret_key,
        secure=endpoint.startswith("https://"),
    )

def get_object_bytes(m: Minio, bucket: str, key: str) -> bytes:
    obj = m.get_object(bucket, key)
    return obj.read()
