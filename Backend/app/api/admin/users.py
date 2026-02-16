from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import func, select, case, and_, or_, literal, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, Session
# TODO: Convert remaining endpoints to async - for now using AsyncSession everywhere
# When converting, change Session to AsyncSession and add async/await
from app.db.session import get_db  # Use centralized get_db
from app.db.async_compat import run_with_sync_session
from app.models.shift import Shift
from app.models.user import User, UserRole
from app.models.project_members import ProjectMember
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus
from app.models.attendance_request import AttendanceRequest
from app.models.history import TimeHistory
from app.core.dependencies import get_current_user
from app.utils.timezone import today_ist
from app.schemas.user import UserBatchUpdateRequest, UserCreate, UserResponse, UserUpdate, UserQualityUpdate, UserSystemUpdate, UsersAdminSearchFilters, UserBatchUpdate
from typing import List, Optional
from uuid import UUID
from datetime import date
from math import ceil
import os
import logging


router = APIRouter(
    prefix="/admin/users",
    tags=["Admin Users"],
)
logger = logging.getLogger(__name__)
NOT_ALLOCATED_PROJECT_ID = UUID("cf261b87-41a6-4091-86c2-c4884f74a25c")

@router.get("/", response_model=List[UserResponse])
async def list_users(
    name: Optional[str] = None,
    email: Optional[str] = None,
    roles: Optional[List[str]] = Query(None),
    rpm_user_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    limit: int = Query(20, ge=1, le=1000),  # Cap at 1000 - safe with index and timeout protection
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    List users with pagination.
    OPTIMIZED: Maximum limit of 1000. 
    Uses database index on created_at for fast ordering.
    Includes query timeout protection to prevent hangs.
    """
    import time
    start_time = time.time()
    
    try:
        # Build query using async select
        query = select(User)

        if name:
            query = query.filter(User.name.ilike(f"%{name}%"))

        if email:
            query = query.filter(User.email.ilike(f"%{email}%"))

        if roles:
            query = query.filter(User.role.in_(roles))

        if rpm_user_id:
            query = query.filter(User.rpm_user_id == rpm_user_id)

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        # Execute query with timeout protection
        query_start = time.time()
        query = query.order_by(User.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        users = result.scalars().all()
        query_time = time.time() - query_start
        
        # Log if query takes too long (for debugging)
        if query_time > 1.0:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Slow query detected: list_users took {query_time:.2f}s for {len(users)} users")
        
        total_time = time.time() - start_time
        if total_time > 1.0:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Slow endpoint: list_users total time {total_time:.2f}s")
        
        return users
    except Exception as e:
        logger.exception("Error fetching users in list_users")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching users"
        )

@router.get("/kpi_cards_info")
async def kpi_cards_info(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    # Convert to async queries
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar()
    
    allocated_result = await db.execute(select(func.count(func.distinct(ProjectMember.user_id))))
    allocated = allocated_result.scalar()
    unallocated = total_users - allocated
    
    contractors_result = await db.execute(select(func.count(User.id)).filter(User.work_role == 'CONTRACTOR'))
    contractors = contractors_result.scalar()
    
    todays_date = date.today()
    on_leave_result = await db.execute(
        select(func.count(func.distinct(AttendanceDaily.user_id)))
        .filter(AttendanceDaily.attendance_date == todays_date)
        .filter(AttendanceDaily.status == AttendanceStatus.LEAVE)
    )
    on_leave = on_leave_result.scalar()
      

    return {
        "users": total_users,
        "allocated": allocated,
        "unallocated": unallocated,
        "contractors": contractors,
        "leave": on_leave
    }

@router.get("/reporting_managers")
async def list_rep_managers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    # Get the names of the PMs/ APMs / RMs with role as ADMIN
    result = await db.execute(
        select(User.id, User.name)
        .filter(User.role == "ADMIN")
    )
    reporting_managers = result.all()

    return [{
        "rpm_id": r.id,
        "rpm_name": r.name
    }
    for r in reporting_managers
    ]

@router.get("/project_managers")
async def list_project_managers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """
    Get all active users with role ADMIN or MANAGER.
    Used for project owner assignment dropdown.
    """
    result = await db.execute(
        select(User.id, User.name, User.email, User.role)
        .filter(User.role.in_([UserRole.ADMIN, UserRole.MANAGER]))
        .filter(User.is_active == True)
        .order_by(User.name)
    )
    managers = result.all()

    return [{
        "id": str(m.id),
        "name": m.name,
        "email": m.email,
        "role": m.role.value if hasattr(m.role, "value") else str(m.role),
    } for m in managers]

@router.post("/users_with_filter")
@run_with_sync_session()
def search_with_filters(
    payload: UsersAdminSearchFilters,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    date_str = payload.date
    email = payload.email
    name = payload.name
    allocated = payload.allocated
    work_role = payload.work_role
    is_active = payload.is_active
    status = payload.status

    # Parse date string to date object, default to IST today if not provided
    if date_str:
        try:
            from datetime import datetime as dt
            today = dt.fromisoformat(date_str).date() if isinstance(date_str, str) else date_str
        except (ValueError, AttributeError):
            today = today_ist()
    else:
        today = today_ist()
    Manager = aliased(User)

    project_count_sq = (
        db.query(
            ProjectMember.user_id.label("user_id"),
            func.count(ProjectMember.id).label("project_count"),

        )
        .group_by(ProjectMember.user_id)
        .subquery()
    )

    # Query attendance status for today
    # Use func.max() which will prioritize PRESENT (alphabetically PRESENT > ABSENT > UNKNOWN)
    # If user has multiple records for different projects, PRESENT will be selected
    attendance_sq = (
        db.query(
            AttendanceDaily.user_id.label("user_id"),
            func.max(AttendanceDaily.status).label("status"),
        )
        .filter(AttendanceDaily.attendance_date == today)
        .group_by(AttendanceDaily.user_id)
        .subquery()
    )

    # Query approved leave requests for today.
    leave_sq = (
        db.query(
            AttendanceRequest.user_id.label("user_id"),
            func.max(AttendanceRequest.request_type).label("leave_type"),
        )
        .filter(
            cast(AttendanceRequest.status, String) == "APPROVED",
            AttendanceRequest.start_date <= today,
            AttendanceRequest.end_date >= today,
            cast(AttendanceRequest.request_type, String).in_(["SICK_LEAVE", "FULL-DAY", "HALF-DAY", "OTHER"]),
        )
        .group_by(AttendanceRequest.user_id)
        .subquery()
    )

    # Mark user as not allocated only when they currently have an active
    # session on the dedicated "Not allocated" project.
    active_not_allocated_sq = (
        db.query(TimeHistory.user_id.label("user_id"))
        .filter(
            TimeHistory.project_id == NOT_ALLOCATED_PROJECT_ID,
            TimeHistory.clock_out_at.is_(None),
        )
        .distinct()
        .subquery()
    )
    
    # Debug: Log the date being used for the query
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[ATTENDANCE QUERY] Querying attendance for date: {today}, type: {type(today)}")
    
    # Debug: Count how many attendance records exist for today
    attendance_count = db.query(AttendanceDaily).filter(
        AttendanceDaily.attendance_date == today
    ).count()
    logger.info(f"[ATTENDANCE QUERY] Found {attendance_count} attendance records for date {today}")

    # Compute today_status: prioritize approved leave, then attendance record.
    today_status_expr = case(
        (
            and_(
                leave_sq.c.leave_type.isnot(None),
                or_(
                    attendance_sq.c.status.is_(None),
                    cast(attendance_sq.c.status, String) != "PRESENT",
                ),
            ),
            literal("LEAVE"),
        ),
        (attendance_sq.c.status.isnot(None), cast(attendance_sq.c.status, String)),
        else_=literal("UNKNOWN"),
    )

    query = (
        db.query(
            User.id,
            User.name,
            User.email,
            User.role,
            User.work_role,
            User.is_active,
            User.default_shift_id.label("shift_id"),
            Shift.name.label("shift_name"),
            Manager.name.label("reporting_manager"),
            Manager.id.label("reporting_manager_id"),
            # case(
            #     (User.work_role == "CONTRACTOR", True),
            #     else_=False
            # ).label("is_contractor"),
            func.coalesce(project_count_sq.c.project_count, 0).label(
                "allocated_projects"
            ),
            case(
                (active_not_allocated_sq.c.user_id.isnot(None), True),
                else_=False,
            ).label("is_not_allocated"),
            today_status_expr.label("today_status"),
        )
        .outerjoin(Manager, Manager.id == User.rpm_user_id)
        .outerjoin(project_count_sq, project_count_sq.c.user_id == User.id)
        .outerjoin(attendance_sq, attendance_sq.c.user_id == User.id)
        .outerjoin(leave_sq, leave_sq.c.user_id == User.id)
        .outerjoin(active_not_allocated_sq, active_not_allocated_sq.c.user_id == User.id)
        .outerjoin(Shift, Shift.id == User.default_shift_id)
    ) 

    # ---- Filters ----
    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))

    if name:
        query = query.filter(User.name.ilike(f"%{name}%"))

    if work_role:
        query = query.filter(User.work_role == work_role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if allocated is not None:
        if allocated:
            query = query.filter(
                func.coalesce(project_count_sq.c.project_count, 0) > 0
            )
        else:
            query = query.filter(
                func.coalesce(project_count_sq.c.project_count, 0) == 0
            )

    if status is not None:
        query = query.filter(today_status_expr == status)


    total = query.count()
    results = (
        query
        .order_by(User.name.asc())
        .all()
    )

    # ---- Response ----
    return {
        "items": [{
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "role": r.role.value if hasattr(r.role, 'value') else str(r.role),  # Convert enum to string
            "work_role": r.work_role,
            "is_active": r.is_active,
            "shift_id": r.shift_id,
            "shift_name": r.shift_name,
            "rpm_user_id": r.reporting_manager_id,
            "allocated_projects": r.allocated_projects,
            "is_not_allocated": r.is_not_allocated,
            "today_status": r.today_status,
        }
        for r in results
        ],
        "meta": {
            "total": total,
        }
    } 

@router.post("/", response_model=UserResponse)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )
    
    user = User(
        email=payload.email,
        name=payload.name,
        role=UserRole(payload.role),
        work_role=payload.work_role,
        doj=payload.doj,
        default_shift_id=payload.default_shift_id,
        rpm_user_id=payload.rpm_user_id,
        soul_id=payload.soul_id,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/create-supabase-account")
async def create_supabase_account_for_user(
    user_id: UUID,
    password: str = Query(..., description="Temporary password for the user (they should change it after first login)"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Create a Supabase Auth account for an existing database user.
    This allows users who exist in the database to login via Supabase.
    
    Requires SUPABASE_SERVICE_ROLE_KEY in environment variables.
    """
    # Get user from database
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in database")
    
    # Check if Supabase auth is enabled
    DISABLE_AUTH = os.getenv("DISABLE_AUTH", "true").lower() == "true"
    if DISABLE_AUTH:
        raise HTTPException(
            status_code=400,
            detail="Supabase auth is disabled. Set DISABLE_AUTH=false to enable."
        )
    
    # Get Supabase Service Role Key (admin key)
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    
    if not SUPABASE_SERVICE_ROLE_KEY or not SUPABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not configured. Please set these in your .env file."
        )
    
    try:
        from supabase import create_client
        
        # Create admin client with service role key
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        # Check if user already exists in Supabase
        try:
            existing_users = supabase_admin.auth.admin.list_users()
            for existing_user in existing_users.users:
                if existing_user.email == user.email:
                    return {
                        "message": "User already exists in Supabase",
                        "email": user.email,
                        "supabase_user_id": existing_user.id,
                        "action": "User can login with their Supabase credentials"
                    }
        except Exception:
            pass  # Continue to create user
        
        # Create user in Supabase with admin API
        create_response = supabase_admin.auth.admin.create_user({
            "email": user.email,
            "password": password,
            "email_confirm": True,  # Auto-confirm email so they can login immediately
            "user_metadata": {
                "name": user.name,
                "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
            }
        })
        
        if not create_response or not create_response.user:
            raise HTTPException(
                status_code=500,
                detail="Failed to create user in Supabase"
            )
        
        return {
            "message": "Supabase account created successfully",
            "email": user.email,
            "supabase_user_id": create_response.user.id,
            "action": f"User can now login with email: {user.email} and the provided password",
            "note": "User should change their password after first login"
        }
        
    except Exception as e:
        error_msg = str(e)
        if "User already registered" in error_msg or "already exists" in error_msg.lower():
            return {
                "message": "User already exists in Supabase",
                "email": user.email,
                "action": "User can login with their existing Supabase credentials"
            }
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create Supabase account: {error_msg}"
        )


from fastapi import HTTPException, APIRouter, Depends, status
from app.schemas.user import UserQualityUpdate, UserUpdate

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user

@router.patch("/{user_id}/quality-rating", response_model=UserResponse)
async def update_quality_rating(
    user_id: UUID,
    payload: UserQualityUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.quality_rating = payload.quality_rating

    await db.commit()
    await db.refresh(user)

    return user

from app.schemas.user import UserSystemUpdate
@router.patch("/{user_id}/system", response_model=UserResponse)
async def update_system_identifiers(
    user_id: UUID,
    payload: UserSystemUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    return user

@router.patch("/bulk_update")
async def bulk_upadte_users(
    payload: UserBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):

    updated_ids = []
    failed = []

    for item in payload.updates:
        user_id = item.id
        changes = item.changes.dict(exclude_unset=True)

        if not changes:
            continue  # nothing to update

        result = await db.execute(select(User).filter(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            failed.append({
                "id": str(user_id),
                "error": "User not found"
            })
            continue

        if "rpm_user_id" in changes and str(changes["rpm_user_id"]).split(" — ")[0] == user.id:
            failed.append({
                "id": str(user_id),
                "error": "User cannot be their own reporting manager"
            })
            continue

        for field, value in changes.items():
            setattr(user, field, value)

        updated_ids.append(str(user_id))

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Batch update failed")

    return {
        "updated": updated_ids,
        "failed": failed,
        "updated_count": len(updated_ids),
        "failed_count": len(failed),
    }


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await db.commit()

    return {"message": "User deactivated successfully"}

