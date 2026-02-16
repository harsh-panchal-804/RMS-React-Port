from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List, Optional
import uuid
from uuid import UUID
from app.db.session import get_db  # Use centralized get_db
from app.db.async_compat import run_with_sync_session
from app.models.history import TimeHistory, ApprovalStatus
from app.models.project import Project
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus
from app.models.project_members import ProjectMember
from app.models.project_owners import ProjectOwner
from app.schemas.history import TimeHistoryResponse, ClockInRequest, ClockOutRequest, HomeTimeResponse
from app.core.dependencies import get_current_user
from app.models.user import User
from app.utils.timezone import now_ist, today_ist

from app.schemas.history import ApprovalRequest

router = APIRouter(prefix="/time", tags=["Time Tracking"])
MAX_SESSION_DURATION = timedelta(hours=14)

# --- 1. CLOCK IN ---
@router.post("/clock-in", response_model=TimeHistoryResponse)
@run_with_sync_session()
def clock_in(
    payload: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import logging
    logger = logging.getLogger(__name__)

    # Check if user already has an active session (where clock_out_at is NULL)
    active_session = db.query(TimeHistory).filter(
        TimeHistory.user_id == current_user.id,
        TimeHistory.clock_out_at == None
    ).first()

    if active_session:
        raise HTTPException(
            status_code=400, 
            detail="You are already clocked in. Please clock out first."
        )

    # Create new session
    # Note: sheet_date defaults to today, status defaults to 'PENDING'
    clock_in_at = payload.clock_in_at or now_ist()
    today = today_ist()

    # --- AUTO-ALLOCATION LOGIC ---
    # Check if user is already allocated to this project.
    existing_allocation = db.query(ProjectMember).filter(
        ProjectMember.user_id == current_user.id,
        ProjectMember.project_id == payload.project_id,
        ProjectMember.is_active == True
    ).first()

    if not existing_allocation:
        logger.info(f"[CLOCK_IN] User {current_user.id} not allocated to project {payload.project_id}. Auto-allocating...")

        # Get project details for logging/notification
        project = db.query(Project).filter(Project.id == payload.project_id).first()
        project_name = project.name if project else "Unknown Project"

        # Create new project member allocation.
        new_allocation = ProjectMember(
            user_id=current_user.id,
            project_id=payload.project_id,
            work_role=payload.work_role or "Panelist",
            assigned_from=today,
            assigned_to=None,
            is_active=True
        )
        db.add(new_allocation)
        logger.info(f"[CLOCK_IN] Auto-allocated user {current_user.name} to project {project_name} as {payload.work_role}")

        # Send notification to project owner/PM (best effort).
        try:
            project_owner = db.query(ProjectOwner).filter(
                ProjectOwner.project_id == payload.project_id
            ).first()

            if project_owner:
                pm_user = db.query(User).filter(User.id == project_owner.user_id).first()
                if pm_user:
                    from app.services.notification_service import send_auto_allocation_email
                    send_auto_allocation_email(
                        pm_email=pm_user.email,
                        pm_name=pm_user.name,
                        user_name=current_user.name,
                        user_email=current_user.email,
                        project_name=project_name,
                        work_role=payload.work_role or "Panelist",
                        allocation_date=str(today)
                    )
                    logger.info(f"[CLOCK_IN] Sent auto-allocation notification to PM {pm_user.email}")
                else:
                    logger.warning("[CLOCK_IN] PM user not found for project owner")
            else:
                logger.warning(f"[CLOCK_IN] No project owner found for project {payload.project_id}")
        except Exception as e:
            # Never fail clock-in if notification fails.
            logger.error(f"[CLOCK_IN] Failed to send auto-allocation notification: {e}")
    # --- END AUTO-ALLOCATION LOGIC ---

    new_session = TimeHistory(
        user_id=current_user.id,
        project_id=payload.project_id,
        work_role=payload.work_role,
        clock_in_at=clock_in_at,
        sheet_date=today,
        tasks_completed=0,
        status=ApprovalStatus.PENDING,
        
    )
    
    db.add(new_session)
    
    # Create or update AttendanceDaily record to mark user as PRESENT
    # This ensures the admin dashboard shows the correct present count
    # Check for existing record for this user and date (across all projects)
    existing_attendance = db.query(AttendanceDaily).filter(
        AttendanceDaily.user_id == current_user.id,
        AttendanceDaily.attendance_date == today
    ).first()

    logger.info(f"[CLOCK_IN] User {current_user.id} clocking in on {today} (type: {type(today)})")
    
    if existing_attendance:
        logger.info(f"[CLOCK_IN] Found existing attendance record with status: {existing_attendance.status}")
        # Update existing record - only update status if it's not already set by a request (LEAVE/WFH)
        # Don't override LEAVE or WFH status that might have been set by attendance requests
        if existing_attendance.status in [AttendanceStatus.UNKNOWN, AttendanceStatus.ABSENT]:
            existing_attendance.status = AttendanceStatus.PRESENT
            logger.info(f"[CLOCK_IN] Updated status to PRESENT")
        # Update project_id if it's different (user might have switched projects)
        if existing_attendance.project_id != payload.project_id:
            existing_attendance.project_id = payload.project_id
        existing_attendance.first_clock_in_at = clock_in_at
        existing_attendance.source = "CLOCK_IN"
    else:
        # Create new attendance record
        logger.info(f"[CLOCK_IN] Creating new attendance record with status PRESENT")
        attendance_record = AttendanceDaily(
            user_id=current_user.id,
            project_id=payload.project_id,
            attendance_date=today,
            status=AttendanceStatus.PRESENT,
            first_clock_in_at=clock_in_at,
            source="CLOCK_IN",
            shift_id=current_user.default_shift_id
        )
        db.add(attendance_record)
    
    db.commit()
    # Refresh the attendance record for consistency
    if existing_attendance:
        db.refresh(existing_attendance)
        logger.info(f"[CLOCK_IN] Final attendance status after commit: {existing_attendance.status}")
    else:
        db.refresh(attendance_record)
        logger.info(f"[CLOCK_IN] Final attendance status after commit: {attendance_record.status}")
    db.refresh(new_session)
    if new_session.project:
        new_session.project_name = new_session.project.name
    return new_session

# --- 2. CLOCK OUT ---
@router.put("/clock-out", response_model=TimeHistoryResponse)
@run_with_sync_session()
def clock_out(
    payload: ClockOutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find the active session for this user
    active_session = db.query(TimeHistory).filter(
        TimeHistory.user_id == current_user.id,
        TimeHistory.clock_out_at == None
    ).first()

    if not active_session:
        raise HTTPException(
            status_code=400, 
            detail="No active session found. You must clock in first."
        )

    # Cap manual clock-out time to 14 hours from clock in.
    clock_out_at = min(now_ist(), active_session.clock_in_at + MAX_SESSION_DURATION)
    active_session.clock_out_at = clock_out_at
    active_session.tasks_completed = payload.tasks_completed
    active_session.notes = payload.notes
    
    # Calculate minutes worked from clock in to clock out
    minutes_worked = (clock_out_at - active_session.clock_in_at).total_seconds() / 60
    active_session.minutes_worked = round(minutes_worked, 2)
    
    # Update AttendanceDaily record with clock out time.
    # Use session sheet_date instead of today in case of cross-date session handling.
    existing_attendance = db.query(AttendanceDaily).filter(
        AttendanceDaily.user_id == current_user.id,
        AttendanceDaily.project_id == active_session.project_id,
        AttendanceDaily.attendance_date == active_session.sheet_date
    ).first()
    
    if existing_attendance:
        existing_attendance.last_clock_out_at = clock_out_at
        existing_attendance.minutes_worked = active_session.minutes_worked
    
    db.commit()
    db.refresh(active_session)
    if active_session.project:
        active_session.project_name = active_session.project.name
    return active_session

# --- 3. GET HISTORY ---
@router.get("/history", response_model=List[TimeHistoryResponse])
@run_with_sync_session()
def get_history(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(TimeHistory).filter(
        TimeHistory.user_id == current_user.id
    )

    if start_date:
        query = query.filter(TimeHistory.sheet_date >= start_date)

    if end_date:
        query = query.filter(TimeHistory.sheet_date <= end_date)

    results = query.order_by(TimeHistory.clock_in_at.desc()).all()
    
    # Attach project names for UI
    for r in results:
        if r.project:
            r.project_name = r.project.name
            
    return results



# --- 4. APPROVE SESSION (Manager Action) ---
@router.put("/history/{history_id}/approve", response_model=TimeHistoryResponse)
@run_with_sync_session()
def approve_session(
    history_id: UUID,
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Find the session
    session = db.query(TimeHistory).filter(TimeHistory.id == history_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    # 2. Update fields
    if session.user_id == current_user.id:
        raise HTTPException(
            status_code=403, 
            detail="You cannot approve your own timesheet."
        )
    
    try:
        session.status = ApprovalStatus(payload.status.upper())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Allowed values: PENDING, APPROVED, REJECTED."
        )
    session.approval_comment = payload.approval_comment
    session.approved_by_user_id = current_user.id
    session.approved_at = now_ist()
    
    db.commit()
    db.refresh(session)
    
    # 3. If approved, trigger metrics recalculation for this project and date
    # This ensures metrics are updated immediately after approval
    if payload.status == "APPROVED" and session.clock_out_at:
        try:
            from app.services.scheduler_service import calculate_daily_productivity_for_project
            # Recalculate metrics for this project and date
            calculate_daily_productivity_for_project(
                project_id=session.project_id,
                calculation_date=session.sheet_date,
                db=db
            )
            print(f"[APPROVAL] Metrics recalculated for project {session.project_id} on {session.sheet_date}")
        except Exception as e:
            # Log error but don't fail the approval
            print(f"[APPROVAL ERROR] Failed to recalculate metrics after approval: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # 4. Attach project name for UI (Safety check)
    if session.project:
        session.project_name = session.project.name
        
    return session

# --- 5. GET CURRENT ACTIVE SESSION (For Home Page Logic) ---
@router.get("/current", response_model=Optional[TimeHistoryResponse])
@run_with_sync_session()
def get_current_active_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Checks if the user has a session running (Clock Out is NULL).
    Returns the session details if yes, or null if no.
    """
    active_session = db.query(TimeHistory).filter(
        TimeHistory.user_id == current_user.id,
        TimeHistory.clock_out_at == None
    ).first()

    if active_session:
        # Manually attach project name so the UI can display "Working on: Project Alpha"
        if active_session.project:
            active_session.project_name = active_session.project.name
        return active_session
    
    return None


# --- 6. GET HOME DATA (current session + today's sessions in one call) ---
@router.get("/home", response_model=HomeTimeResponse)
@run_with_sync_session()
def get_home_time_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns current active session (if any) and today's sessions in one request.
    Reduces round-trips for the Home page after clock in/out.
    """
    today = today_ist()

    # 1. Active session (clock_out_at IS NULL)
    active_session = db.query(TimeHistory).filter(
        TimeHistory.user_id == current_user.id,
        TimeHistory.clock_out_at == None
    ).first()
    if active_session and active_session.project:
        active_session.project_name = active_session.project.name

    # 2. Today's sessions (single query)
    today_sessions = (
        db.query(TimeHistory)
        .filter(
            TimeHistory.user_id == current_user.id,
            TimeHistory.sheet_date == today,
        )
        .order_by(TimeHistory.clock_in_at.desc())
        .all()
    )
    for r in today_sessions:
        if r.project:
            r.project_name = r.project.name

    return HomeTimeResponse(
        current_session=active_session,
        today_sessions=today_sessions,
    )
