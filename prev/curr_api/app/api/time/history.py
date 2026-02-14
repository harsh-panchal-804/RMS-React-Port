from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List, Optional
import uuid
from uuid import UUID
from app.db.session import SessionLocal
from app.models.history import TimeHistory
from app.models.project import Project
from app.models.attendance_daily import AttendanceDaily
from app.schemas.history import TimeHistoryResponse, ClockInRequest, ClockOutRequest, HomeTimeResponse
from app.core.dependencies import get_current_user
from app.models.user import User

from app.schemas.history import ApprovalRequest
from app.utils.timezone import now_ist, today_ist

router = APIRouter(prefix="/time", tags=["Time Tracking"])
MAX_SESSION_DURATION = timedelta(hours=14)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 1. CLOCK IN ---
@router.post("/clock-in", response_model=TimeHistoryResponse)
def clock_in(
    payload: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    new_session = TimeHistory(
        user_id=current_user.id,
        project_id=payload.project_id,
        work_role=payload.work_role,
        clock_in_at=clock_in_at,
        sheet_date=today,
        tasks_completed=0,
        status="PENDING" ,
        
    )
    
    db.add(new_session)
    
    # Create or update AttendanceDaily record to mark user as PRESENT
    # This ensures the admin dashboard shows the correct present count
    # Check for existing record for this user and date (across all projects)
    existing_attendance = db.query(AttendanceDaily).filter(
        AttendanceDaily.user_id == current_user.id,
        AttendanceDaily.attendance_date == today
    ).first()
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[CLOCK_IN] User {current_user.id} clocking in on {today} (type: {type(today)})")
    
    if existing_attendance:
        logger.info(f"[CLOCK_IN] Found existing attendance record with status: {existing_attendance.status}")
        # Update existing record - only update status if it's not already set by a request (LEAVE/WFH)
        # Don't override LEAVE or WFH status that might have been set by attendance requests
        if existing_attendance.status in ["UNKNOWN", "ABSENT"]:
            existing_attendance.status = "PRESENT"
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
            status="PRESENT",
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
    # --------------------------
    
    session.status = payload.status
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
