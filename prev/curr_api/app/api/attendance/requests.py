from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models.attendance_request import AttendanceRequest
from app.schemas.attendance_request import (
    AttendanceRequestCreate,
    AttendanceRequestUpdate,
    AttendanceRequestResponse,
)
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project_members import ProjectMember
from app.models.project_owners import ProjectOwner
from app.models.project import Project
from app.services.notification_service import send_attendance_request_created_email
from app.utils.timezone import now_ist, today_ist
from app.models.history import TimeHistory


router = APIRouter(
    prefix="/attendance/requests",
    tags=["Leave/WFH Requests"]
)

# CREATE 
@router.post("/", response_model=AttendanceRequestResponse)
def create_request(
    payload: AttendanceRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = AttendanceRequest(
    user_id=user.id,
    project_id=payload.project_id,
    request_type=payload.request_type,
    status="PENDING",
    start_date=payload.start_date,
    end_date=payload.end_date,
    start_time=payload.start_time,
    end_time=payload.end_time,
    reason=payload.reason,
    attachment_url=payload.attachment_url,
    updated_at=now_ist()
)

    db.add(req)
    db.commit()
    db.refresh(req)

    # -------------------------------------------------------------------------
    # NOTIFY PROJECT OWNERS (PM) + RPM ABOUT THE NEW REQUEST
    # -------------------------------------------------------------------------
    # Determine which project(s) to use for manager notifications (in order):
    # 1. If user is clocked in today and has NOT clocked out → use that project.
    # 2. If user did not log in today → use the last project they logged into.
    # 3. Fallback: use the project selected on the leave request.
    # 4. If still no project (e.g. user de-allocated from all projects) → use last
    #    project the user was allocated to ("last PM"); mail goes to that PM.
    # 5. If user was never allocated to any project → only RPM receives the mail.
    #    (rpm_user_id should be non-null for all users to guarantee a recipient.)
    # -------------------------------------------------------------------------
    recipients = {}

    # Add RPM (reporting manager) to recipients if set on the user.
    if user.rpm_user_id:
        rpm_user = db.query(User).filter(User.id == user.rpm_user_id).first()
        if rpm_user and rpm_user.email and rpm_user.id != user.id:
            recipients[rpm_user.id] = rpm_user

    today = today_ist()

    # Check for an active session today: user clocked in and has not clocked out.
    active_session_today = db.query(TimeHistory).filter(
        TimeHistory.user_id == user.id,
        TimeHistory.clock_out_at.is_(None),
        TimeHistory.sheet_date == today,
    ).first()

    if active_session_today:
        # User is currently clocked in → notify owners of this project only.
        project_ids = [active_session_today.project_id]
    else:
        # User did not log in today (or already clocked out) → use last project they logged into.
        last_session_before_today = (
            db.query(TimeHistory)
            .filter(
                TimeHistory.user_id == user.id,
                TimeHistory.sheet_date < today,
            )
            .order_by(TimeHistory.sheet_date.desc(), TimeHistory.clock_in_at.desc())
            .first()
        )
        if last_session_before_today:
            project_ids = [last_session_before_today.project_id]
        else:
            # No clock-in history (e.g. new user) → fallback to project selected on the request.
            project_ids = [req.project_id] if req.project_id else []

    # If still no project (e.g. user de-allocated from all, no clock-in, no request project),
    # use the last project the user was allocated to so mail goes to "last PM".
    if not project_ids:
        last_allocation = (
            db.query(ProjectMember.project_id)
            .filter(ProjectMember.user_id == user.id)
            .order_by(ProjectMember.updated_at.desc())
            .first()
        )
        if last_allocation:
            (pid,) = last_allocation
            project_ids = [pid]
    # If project_ids still empty → user was never allocated; only RPM receives (already in recipients).

    # Build project names string for the email body.
    project_names = None
    if project_ids:
        project_names_list = db.query(Project.name).filter(Project.id.in_(project_ids)).all()
        project_names = ", ".join(sorted({name for (name,) in project_names_list if name}))

    # Add all project owners of the determined project(s) to recipients.
    if project_ids:
        owners = db.query(User).join(
            ProjectOwner, ProjectOwner.user_id == User.id
        ).filter(
            ProjectOwner.project_id.in_(project_ids),
        ).all()
        for owner in owners:
            if owner.email and owner.id != user.id:
                recipients[owner.id] = owner

    for recipient in recipients.values():
        send_attendance_request_created_email(
            recipient_email=recipient.email,
            recipient_name=recipient.name or recipient.email,
            requester_name=user.name or user.email,
            request_type=req.request_type,
            start_date=str(req.start_date),
            end_date=str(req.end_date),
            reason=req.reason,
            project_names=project_names,
        )

    return req


# READ MY REQUESTS 
@router.get("/", response_model=List[AttendanceRequestResponse])
def get_my_requests(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(AttendanceRequest).filter(
        AttendanceRequest.user_id == user.id
    ).order_by(AttendanceRequest.created_at.desc()).all()


# READ BY ID
@router.get("/{request_id}", response_model=AttendanceRequestResponse)
def get_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = db.query(AttendanceRequest).filter(
        and_(
            AttendanceRequest.id == request_id,
            AttendanceRequest.user_id == user.id,
            )
        ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    return req


# UPDATE
@router.put("/{request_id}", response_model=AttendanceRequestResponse)
def update_request(
    request_id: UUID,
    payload: AttendanceRequestUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = db.query(AttendanceRequest).filter(
        and_(
            AttendanceRequest.id == request_id,
            AttendanceRequest.user_id == user.id,
        )
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(req, k, v)

    db.commit()
    db.refresh(req)
    return req


#  DELETE 
@router.delete("/{request_id}")
def delete_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = db.query(AttendanceRequest).filter(
        and_(
            AttendanceRequest.id == request_id,
            AttendanceRequest.user_id == user.id,
        )
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    db.delete(req)
    db.commit()

    return {"message": "Attendance request deleted successfully"}


# =====================
# ADMIN ROUTER - For managers to view all requests
# =====================
admin_router = APIRouter(
    prefix="/admin/attendance-requests",
    tags=["Admin - Leave/WFH Requests"]
)


@admin_router.get("/")
def list_all_requests_with_user_info(
    status: Optional[str] = None,
    user_id: Optional[UUID] = None,
    request_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to list all attendance requests with user info.
    Returns request data with user_name for display in Streamlit.
    """
    from app.models.user import User
    
    query = db.query(
        AttendanceRequest,
        User.name.label('user_name'),
        User.email.label('user_email')
    ).join(User, AttendanceRequest.user_id == User.id)

    if status:
        query = query.filter(AttendanceRequest.status == status)
    
    if user_id:
        query = query.filter(AttendanceRequest.user_id == user_id)
    
    if request_type:
        query = query.filter(AttendanceRequest.request_type == request_type)

    results = (
        query
        .order_by(AttendanceRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    # Convert to dict with user info
    response = []
    for req, user_name, user_email in results:
        req_dict = {
            "id": str(req.id),
            "user_id": str(req.user_id),
            "user_name": user_name,
            "user_email": user_email,
            "project_id": str(req.project_id) if req.project_id else None,
            "request_type": req.request_type,
            "status": req.status,
            "start_date": str(req.start_date),
            "end_date": str(req.end_date),
            "reason": req.reason,
            "created_at": str(req.created_at),
        }
        response.append(req_dict)
    
    return response


@admin_router.get("/{request_id}", response_model=AttendanceRequestResponse)
def admin_get_request(request_id: UUID, db: Session = Depends(get_db)):
    """Get a specific attendance request by ID"""
    req = db.query(AttendanceRequest).filter(
        AttendanceRequest.id == request_id
    ).first()
    
    if not req:
        raise HTTPException(status_code=404, detail="Attendance request not found")
    
    return req
