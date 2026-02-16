from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
# from app.middlewares.auth import auth_middleware
from app.api.admin import users, projects
from app.api.admin import shifts
from app.api.admin import projects_daily
from dotenv import load_dotenv
from app.api import analytics
from app.api import reports
import time
import logging

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Resource Management System")

# Request logging middleware - MUST be first to catch all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests and response times"""
    start_time = time.time()
    
    # Log incoming request
    logger.info(f"→ {request.method} {request.url.path}")
    
    # Log connection pool status before request
    from app.db.session import engine
    # For async engines, use sync_engine to access pool
    pool = engine.sync_engine.pool
    checked_out_before = pool.checkedout()
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response immediately (don't delay response)
        checked_out_after = pool.checkedout()
        pool_size = pool.size()
        max_overflow = pool._max_overflow if hasattr(pool, '_max_overflow') else 0
        
        # Log immediately - response is ready to send
        logger.info(
            f"← {request.method} {request.url.path} "
            f"Status: {response.status_code} Time: {process_time:.3f}s "
            f"Pool: {checked_out_after}/{pool_size + max_overflow}"
        )
        
        # Warn on slow requests
        if process_time > 2.0:
            logger.warning(
                f"⚠️ SLOW REQUEST: {request.method} {request.url.path} "
                f"took {process_time:.2f}s"
            )
        
        # Return response immediately - don't block on logging
        return response
    except Exception as e:
        process_time = time.time() - start_time
        pool = engine.sync_engine.pool
        checked_out_after = pool.checkedout()
        pool_size = pool.size()
        max_overflow = pool._max_overflow if hasattr(pool, '_max_overflow') else 0
        logger.error(
            f"✗ {request.method} {request.url.path} "
            f"ERROR after {process_time:.2f}s: {str(e)} "
            f"Pool: {checked_out_after}/{pool_size + max_overflow}",
            exc_info=True
        )
        raise

# app.middleware("http")(auth_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import auth

app.include_router(users.router)
app.include_router(projects.router)
app.include_router(auth.router)
app.include_router(projects_daily.router)

from app.api.time import history
app.include_router(history.router)
from app.api import me
app.include_router(me.router)

app.include_router(shifts.router)

from app.api.admin import user_daily

app.include_router(user_daily.router)


from app.api.admin import dashboard as admin_dashboard

app.include_router(admin_dashboard.router)
from app.api.dashboard import user_history

app.include_router(user_history.router)

from app.api.attendance import requests
app.include_router(requests.router)

from app.api import attendance_daily
app.include_router(attendance_daily.router)

from app.api.admin.bulk_uploads import router as bulk_uploads_router
app.include_router(bulk_uploads_router)

from app.api.admin.attendance_requests import admin_router as admin_attendance_requests_router
app.include_router(admin_attendance_requests_router)

from app.api.admin import attendance_request_approvals
app.include_router(attendance_request_approvals.router)
app.include_router(analytics.router)
app.include_router(reports.router)

from app.api.project_manager import project_manager
app.include_router(project_manager.router)

from app.api.admin import router as admin_router
from app.api.admin import role_drilldown

app.include_router(admin_router)
app.include_router(role_drilldown.router)

from app.services.scheduler_service import start_scheduler, stop_scheduler

@app.on_event("startup")
async def startup_event():
    """Application startup"""
    logger.info("🚀 Application starting up...")
    try:
        start_scheduler()
        logger.info("▶️ Scheduler is ENABLED")
    except Exception as e:
        logger.error(f"Warning: Could not start scheduler: {e}")

@app.get("/health")
async def health_check():
    """Health check endpoint to verify server is responding"""
    from app.db.session import engine
    from sqlalchemy import text
    try:
        # Check database connection (async)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            await conn.commit()
        pool = engine.sync_engine.pool
        return {
            "status": "ok",
            "pool_size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "driver": "asyncpg"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "error", "message": str(e)}

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info("🛑 Application shutting down...")
    try:
        stop_scheduler()
    except Exception as e:
        logger.error(f"Warning: Could not stop scheduler: {e}")
