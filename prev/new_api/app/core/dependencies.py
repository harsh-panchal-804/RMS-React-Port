import os
import uuid
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date

from app.db.session import get_db as get_db_session  # Import centralized get_db
from app.models.user import User, UserRole

# Note: uuid and date are still used in DISABLE_AUTH mode for creating local admin user

# ============================================
# AUTH TOGGLE CONFIGURATION
# ============================================
# To DISABLE Supabase Auth: Set DISABLE_AUTH=true in .env
# To ENABLE Supabase Auth:  Set DISABLE_AUTH=false in .env
# Default: DISABLED (true) for development convenience
# ============================================
DISABLE_AUTH = os.getenv("DISABLE_AUTH", "true").lower() == "true"

# Print auth mode on import (for debugging)
if DISABLE_AUTH:
    print("🔓 AUTH MODE: DISABLED (Bypass Mode - No authentication required)")
else:
    print("🔒 AUTH MODE: ENABLED (Supabase Google Authentication Required)")

# Re-export get_db from centralized location to maintain compatibility
get_db = get_db_session

# ============================================
# TEMPORARY AUTH BYPASS - Supabase Auth Disabled
# ============================================
# Set DISABLE_AUTH=true in .env to use this bypass
# Set DISABLE_AUTH=false to enable Supabase auth
# ============================================

if DISABLE_AUTH:
    # Cache the admin user to avoid database query on every request
    _cached_admin_user = None
    _cache_lock = None
    
    async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
        """
        AUTH BYPASS MODE - Returns a default admin user.
        No authentication required - all requests use admin@local.dev
        Uses caching to avoid database query on every request.
        """
        import logging
        import asyncio
        logger = logging.getLogger(__name__)
        
        global _cached_admin_user, _cache_lock
        
        # Use cached user if available (fast path)
        if _cached_admin_user is not None:
            return _cached_admin_user
        
        # Initialize lock if needed
        if _cache_lock is None:
            _cache_lock = asyncio.Lock()
        
        # Only one request should query the database
        async with _cache_lock:
            # Double-check after acquiring lock
            if _cached_admin_user is not None:
                return _cached_admin_user
            
            # Query database with index (should be fast)
            result = await db.execute(select(User).filter(User.email == "admin@local.dev"))
            user = result.scalar_one_or_none()

            if not user:
                try:
                    user = User(
                        id=uuid.uuid4(),
                        email="admin@local.dev",
                        name="Local Admin",
                        role=UserRole.ADMIN,
                        is_active=True,
                        doj=date.today(),
                    )
                    db.add(user)
                    await db.commit()
                    await db.refresh(user)
                    logger.info("Created admin@local.dev user")
                except Exception as e:
                    # Handle race condition: another request created the user
                    await db.rollback()
                    logger.debug(f"Race condition detected in user creation: {e}")
                    # Retry query - user should exist now
                    result = await db.execute(select(User).filter(User.email == "admin@local.dev"))
                    user = result.scalar_one_or_none()
                    if not user:
                        logger.error(f"Failed to create/get admin user after retry: {e}")
                        raise
            
            # Cache the user for future requests
            _cached_admin_user = user
            return user
else:
    # Supabase Auth Mode - Google OAuth only
    from app.core.supabase_auth import get_user_from_token
    import hashlib
    import asyncio
    import time
    
    # Cache for Supabase token validation (5 minute TTL)
    _token_cache = {}
    _token_cache_lock = asyncio.Lock()
    
    async def get_current_user(
        authorization: str = Header(...),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        """
        SUPABASE AUTH MODE - Validates Supabase tokens from Google OAuth.
        Uses token caching to reduce Supabase API calls.
        """
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header",
            )

        token = authorization.replace("Bearer ", "")
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:16]
        
        # Check cache first (fast path). Keep lock scope small to avoid contention.
        cached_data = None
        async with _token_cache_lock:
            cached_data = _token_cache.get(token_hash)

        if cached_data and (time.time() - cached_data["timestamp"] < 300):  # 5 minute cache
            user_email = cached_data["email"]
            result = await db.execute(select(User).filter(User.email == user_email))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return user
        
        # Validate token with Supabase (slow path - only if not cached).
        # Run sync network call in a worker thread so it doesn't block the event loop.
        try:
            supabase_user = await asyncio.wait_for(
                asyncio.to_thread(get_user_from_token, token),
                timeout=5.0,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Auth provider timeout. Please retry.",
            )
        try:
            
            # Cache the token result
            async with _token_cache_lock:
                _token_cache[token_hash] = {
                    'email': supabase_user.email,
                    'timestamp': time.time()
                }
                # Clean old cache entries (keep last 100)
                if len(_token_cache) > 100:
                    oldest = min(_token_cache.items(), key=lambda x: x[1]['timestamp'])
                    del _token_cache[oldest[0]]
            
            # Try finding user by email - user MUST already exist in database
            result = await db.execute(select(User).filter(User.email == supabase_user.email))
            user = result.scalar_one_or_none()
            
            # Deny access if user doesn't exist in database
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Your email is not registered in the system. Please contact an administrator.",
                )
            
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is inactive",
                )
            
            return user
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
