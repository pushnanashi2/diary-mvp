def acquire_lock(r, key: str, ttl_sec: int) -> bool:
    return bool(r.set(key, "1", nx=True, ex=ttl_sec))
