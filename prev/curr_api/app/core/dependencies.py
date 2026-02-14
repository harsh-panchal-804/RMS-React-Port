import os
import uuid
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.utils.timezone import today_ist

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================
# TEMPORARY AUTH BYPASS - Supabase Auth Disabled
# ============================================
# Set DISABLE_AUTH=true in .env to use this bypass
# Set DISABLE_AUTH=false to enable Supabase auth
# ============================================

if DISABLE_AUTH:
    def get_current_user(db: Session = Depends(get_db)) -> User:
        """
        AUTH BYPASS MODE - Returns a default admin user.
        No authentication required - all requests use admin@local.dev
        """
        user = db.query(User).filter(User.email == "admin@local.dev").first()

        if not user:
            user = User(
                id=uuid.uuid4(),
                email="admin@local.dev",
                name="Local Admin",
                role=UserRole.ADMIN,
                is_active=True,
                doj=today_ist(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        return user
else:
    # Supabase Auth Mode - Google OAuth only
    from app.core.supabase_auth import get_user_from_token
    import logging
    logger = logging.getLogger(__name__)
    
    def get_current_user(
        authorization: str = Header(...),
        db: Session = Depends(get_db),
    ) -> User:
        """
        SUPABASE AUTH MODE - Validates Supabase tokens from Google OAuth.
        """
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header",
            )

        token = authorization.replace("Bearer ", "")
        
        # Validate token with Supabase
        try:
            supabase_user = get_user_from_token(token)
            logger.info(f"[AUTH] Supabase user email: {supabase_user.email}")
            
            # Try finding user by email - user MUST already exist in database
            user = db.query(User).filter(User.email == supabase_user.email).first()
            
            # Deny access if user doesn't exist in database
            if not user:
                logger.warning(f"[AUTH] User not found in database: {supabase_user.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Your email is not registered in the system. Please contact an administrator.",
                )
            
            if not user.is_active:
                logger.warning(f"[AUTH] User is inactive: {supabase_user.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been deactivated. Please contact an administrator.",
                )
            
            logger.info(f"[AUTH] User authenticated successfully: {user.email}")
            return user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[AUTH] Authentication error: {type(e).__name__}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
