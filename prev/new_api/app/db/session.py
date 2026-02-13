import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import event
from dotenv import load_dotenv
import logging

load_dotenv(dotenv_path=".env") 

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Please set it in your .env file or environment variables. "
        "Example: DATABASE_URL=postgresql://user:password@localhost/dbname"
    )

# Configure logger for connection pool monitoring
logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    """Read integer env vars safely with fallback defaults."""
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        logger.warning("Invalid %s=%r; falling back to %d", name, raw_value, default)
        return default

# Convert postgresql:// to postgresql+asyncpg:// for asyncpg
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    logger.info("✅ Converted DATABASE_URL to use asyncpg")
elif DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    logger.info("✅ Converted DATABASE_URL from psycopg2 to asyncpg")
elif "postgresql+asyncpg://" not in DATABASE_URL:
    logger.warning(f"⚠️ DATABASE_URL doesn't use asyncpg: {DATABASE_URL[:50]}...")

# Keep defaults conservative to avoid saturating hosted Postgres connection limits.
DB_POOL_SIZE = _env_int("DB_POOL_SIZE", 5)
DB_MAX_OVERFLOW = _env_int("DB_MAX_OVERFLOW", 5)
DB_POOL_TIMEOUT = _env_int("DB_POOL_TIMEOUT", 30)
DB_POOL_RECYCLE = _env_int("DB_POOL_RECYCLE", 1800)

# Main application engine with asyncpg
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using (prevents stale connections)
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_recycle=DB_POOL_RECYCLE,
    pool_timeout=DB_POOL_TIMEOUT,  # Timeout when waiting for connection from pool
    echo=False,  # Set to True for SQL query logging (useful for debugging)
)

logger.info(
    "DB pool configured: pool_size=%d max_overflow=%d pool_timeout=%ds pool_recycle=%ds",
    DB_POOL_SIZE,
    DB_MAX_OVERFLOW,
    DB_POOL_TIMEOUT,
    DB_POOL_RECYCLE,
)

# Connection pool monitoring events (async-compatible)
@event.listens_for(engine.sync_engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    logger.debug("New async database connection created")

@event.listens_for(engine.sync_engine.pool, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """Monitor when connections are checked out"""
    pool_size = engine.sync_engine.pool.size()
    checked_out = engine.sync_engine.pool.checkedout()
    overflow = engine.sync_engine.pool.overflow()
    
    # Warn if pool is getting exhausted
    if overflow > 0:
        logger.warning(
            f"⚠️ Connection pool overflow: "
            f"size={pool_size}, checked_out={checked_out}, "
            f"overflow={overflow}"
        )
    elif checked_out > pool_size * 0.8:  # Warn at 80% capacity
        logger.warning(
            f"⚠️ Connection pool at {checked_out}/{pool_size + engine.sync_engine.pool._max_overflow} "
            f"({checked_out/(pool_size + engine.sync_engine.pool._max_overflow)*100:.1f}% capacity)"
        )

@event.listens_for(engine.sync_engine.pool, "checkin")
def receive_checkin(dbapi_conn, connection_record):
    """Monitor when connections are returned to pool"""
    checked_out = engine.sync_engine.pool.checkedout()
    if checked_out == 0:
        logger.debug("All connections returned to pool")
    else:
        logger.debug(f"Connection returned to pool. Still checked out: {checked_out}")

# Async session maker
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncSession:
    """
    Centralized async database session dependency.
    Ensures connections are properly closed to prevent leaks.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            # Rollback on error to prevent connection leaks
            try:
                await session.rollback()
            except Exception:
                pass  # Ignore rollback errors
            logger.error(f"Database session error: {e}", exc_info=True)
            raise
        # Session is automatically closed by async context manager

# Note: Scheduler still uses sync engine (if re-enabled later)
# For now, scheduler is disabled, so we don't need scheduler_engine


