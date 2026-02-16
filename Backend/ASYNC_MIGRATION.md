# Async Migration to asyncpg

## Changes Made

### 1. Database Session (`app/db/session.py`)
- ✅ Converted to `create_async_engine` from `create_engine`
- ✅ Changed to `AsyncSession` and `async_sessionmaker`
- ✅ Updated connection string to use `postgresql+asyncpg://`
- ✅ Updated pool monitoring for async engine

### 2. Dependencies (`app/core/dependencies.py`)
- ✅ `get_current_user` is now `async def`
- ✅ Uses `select()` instead of `query()`
- ✅ Uses `await` for database operations

### 3. Endpoints Converted
- ✅ `/me` - `get_me()` and `update_my_weekoffs()`
- ✅ `/admin/users/` - `list_users()`
- ✅ `/health` - `health_check()`

### 4. Required Package
You need to install `asyncpg`:
```bash
pip install asyncpg
```

Or add to requirements.txt:
```
asyncpg>=0.29.0
```

## Remaining Work

⚠️ **IMPORTANT**: Many endpoints still need conversion. The following patterns need to be updated:

### Pattern 1: Function Definitions
```python
# OLD (sync)
def my_endpoint(db: Session = Depends(get_db)):
    ...

# NEW (async)
async def my_endpoint(db: AsyncSession = Depends(get_db)):
    ...
```

### Pattern 2: Database Queries
```python
# OLD (sync)
user = db.query(User).filter(User.email == email).first()

# NEW (async)
result = await db.execute(select(User).filter(User.email == email))
user = result.scalar_one_or_none()
```

### Pattern 3: Commits
```python
# OLD (sync)
db.commit()
db.refresh(user)

# NEW (async)
await db.commit()
await db.refresh(user)
```

### Pattern 4: Imports
```python
# OLD
from sqlalchemy.orm import Session
from sqlalchemy import func

# NEW
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
```

## Testing

1. **Install asyncpg**:
   ```bash
   pip install asyncpg
   ```

2. **Update DATABASE_URL** (if needed):
   - The code automatically converts `postgresql://` to `postgresql+asyncpg://`
   - But you can set it explicitly: `DATABASE_URL=postgresql+asyncpg://user:pass@host/db`

3. **Test converted endpoints**:
   - `/me` - Should work
   - `/admin/users/` - Should work
   - `/health` - Should show `"driver": "asyncpg"`

4. **Monitor logs**:
   - You should see: `✅ Converted DATABASE_URL to use asyncpg`
   - Connection pool warnings should still work

## Benefits

✅ **No Blocking**: asyncpg is truly async - no GIL blocking
✅ **Better Performance**: Handles concurrent requests much better
✅ **Scalability**: Can handle many more concurrent connections
✅ **FastAPI Native**: FastAPI is designed for async

## Next Steps

1. Test the converted endpoints
2. Convert remaining endpoints one by one
3. Monitor performance improvements
4. Remove psycopg2-binary once all endpoints are converted

## Rollback

If you need to rollback:
1. Revert `app/db/session.py` to use `create_engine`
2. Revert `app/core/dependencies.py` to sync
3. Revert endpoint changes
4. Use `postgresql://` connection string
