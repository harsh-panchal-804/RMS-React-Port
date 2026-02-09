# psycopg2 Performance Fixes

## Problem
You're using `psycopg2-binary==2.9.11`, which can cause blocking issues:
- **First load works** ✅
- **Reloads lag** ❌ (classic psycopg2 blocking symptom)

## Why psycopg2 Can Cause Blocking

1. **Thread Safety Issues**: psycopg2 is not fully thread-safe by default
2. **Connection Pool Blocking**: When pool is exhausted, requests block waiting for connections
3. **GIL (Global Interpreter Lock)**: Python's GIL can cause blocking with psycopg2
4. **Synchronous Operations**: All database operations are blocking

## Solutions

### Option 1: Use NullPool (Quick Fix)
**Pros**: No blocking, each request gets fresh connection
**Cons**: Slower (no connection reuse), more database connections

Uncomment this in `app/db/session.py`:
```python
from sqlalchemy.pool import NullPool

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # No pooling - prevents blocking
    # ... rest of config
)
```

### Option 2: Upgrade to psycopg3 (Recommended)
**Pros**: Better performance, async support, better thread safety
**Cons**: Requires code changes

```bash
pip uninstall psycopg2-binary
pip install psycopg[binary]
```

Then update connection string:
```python
# Change from:
DATABASE_URL = "postgresql://user:pass@host/db"

# To:
DATABASE_URL = "postgresql+psycopg://user:pass@host/db"
```

### Option 3: Use asyncpg (Best for FastAPI)
**Pros**: True async, best performance, designed for FastAPI
**Cons**: Requires async/await refactoring

```bash
pip install asyncpg
```

Then use async sessions:
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@host/db",
    pool_size=30,
    max_overflow=50,
)
```

## Current Configuration

I've added psycopg2-specific optimizations:
- ✅ `pool_pre_ping=True` - Verifies connections before use
- ✅ `pool_timeout=30` - Prevents infinite hangs
- ✅ `pool_recycle=3600` - Recycles stale connections
- ✅ Connection monitoring - Detects pool exhaustion

## Testing

1. **Test with current config** (with scheduler disabled)
2. **If still slow**, try Option 1 (NullPool) - quick test
3. **If NullPool works**, upgrade to psycopg3 (Option 2)
4. **For best performance**, use asyncpg (Option 3) - requires refactoring

## Monitoring

Check connection pool status:
```bash
curl http://localhost:8000/health
```

Watch for these warnings in logs:
- `⚠️ Connection pool overflow` - Pool exhausted
- `⚠️ POSSIBLE CONNECTION LEAK` - Connections not returned
- `⚠️ SLOW REQUEST` - Request taking >2s

## Next Steps

1. **Test current config** (scheduler disabled)
2. **If still blocking**, uncomment NullPool line
3. **If NullPool works**, plan upgrade to psycopg3
4. **Monitor logs** for connection pool warnings
