"""Base processor class for all worker processors"""

class BaseProcessor:
    def __init__(self, db_pool, redis_client, logger):
        self.db_pool = db_pool
        self.redis_client = redis_client
        self.logger = logger

    def process(self, data):
        """Process data - to be implemented by subclasses"""
        raise NotImplementedError('Subclasses must implement process()')

    def _save_result(self, entry_id, result):
        """Save processing result to database"""
        pass

    def _cache_result(self, cache_key, result, ttl=300):
        """Cache result in Redis"""
        pass

    def _get_cached_result(self, cache_key):
        """Get cached result from Redis"""
        return None
