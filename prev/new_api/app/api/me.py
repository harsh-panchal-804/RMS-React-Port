from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, WeekoffUpdate
from app.db.session import get_db  # Use centralized get_db

router = APIRouter(prefix="/me", tags=["Me"])


@router.get("", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    from app.schemas.user import WeekoffDays
    
    # Convert SQLAlchemy enum list to Pydantic enum list
    weekoffs_list = None
    if current_user.weekoffs:
        weekoffs_list = [WeekoffDays(w.value) for w in current_user.weekoffs]
    
    # Create response with converted weekoffs
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_active=current_user.is_active,
        work_role=current_user.work_role,
        doj=current_user.doj,
        default_shift_id=current_user.default_shift_id,
        quality_rating=current_user.quality_rating,
        rpm_user_id=current_user.rpm_user_id,
        soul_id=current_user.soul_id,
        weekoffs=weekoffs_list,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )


@router.patch("/weekoffs", response_model=UserResponse)
async def update_my_weekoffs(
    payload: WeekoffUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the current user's weekoffs (supports multiple)"""
    # Query user from current session to avoid session issues
    result = await db.execute(select(User).filter(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Convert Pydantic enum list to SQLAlchemy enum list
    from app.models.user import WeekoffDays
    weekoff_enums = [WeekoffDays(w.value) for w in payload.weekoffs]
    user.weekoffs = weekoff_enums
    await db.commit()
    await db.refresh(user)
    
    # Return properly formatted response
    from app.schemas.user import WeekoffDays as SchemaWeekoffDays
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        work_role=user.work_role,
        doj=user.doj,
        default_shift_id=user.default_shift_id,
        quality_rating=user.quality_rating,
        rpm_user_id=user.rpm_user_id,
        soul_id=user.soul_id,
        weekoffs=[SchemaWeekoffDays(w.value) for w in user.weekoffs] if user.weekoffs else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
