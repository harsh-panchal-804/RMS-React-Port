-- Performance Optimization Indexes for new_api
-- Run these SQL commands on your PostgreSQL database to improve query performance
-- These indexes significantly speed up the most common queries in the application

-- ============================================================================
-- CRITICAL INDEXES FOR QUALITY-RATINGS ENDPOINT (30s -> <1s improvement)
-- ============================================================================

-- Index for SCD date range queries (MOST IMPORTANT for quality-ratings)
-- This index enables fast lookups of quality records valid for a specific date
CREATE INDEX IF NOT EXISTS idx_user_quality_scd_lookup 
ON user_quality(user_id, project_id, valid_from DESC, valid_to DESC NULLS LAST)
WHERE is_current = true;

-- Index for date range filtering on valid_from
CREATE INDEX IF NOT EXISTS idx_user_quality_valid_from 
ON user_quality(valid_from DESC)
WHERE is_current = true;

-- Index for is_current filter with user/project
CREATE INDEX IF NOT EXISTS idx_user_quality_current_user_project 
ON user_quality(is_current, user_id, project_id)
WHERE is_current = true;

-- ============================================================================
-- CRITICAL INDEXES FOR /admin/dashboard/live ENDPOINT
-- ============================================================================

-- Partial index for active sessions (clock_out_at IS NULL)
-- This makes the /admin/dashboard/live query 10-100x faster
CREATE INDEX IF NOT EXISTS idx_history_clock_out_null 
ON history(clock_in_at DESC) 
WHERE clock_out_at IS NULL;

-- Composite index for active sessions with user/project joins
CREATE INDEX IF NOT EXISTS idx_history_active_sessions_join 
ON history(user_id, project_id, clock_in_at DESC) 
WHERE clock_out_at IS NULL;

-- ============================================================================
-- USER_DAILY_METRICS TABLE INDEXES
-- ============================================================================

-- Index for queries filtering by project_id and metric_date
-- Used by: Project Resource Allocation Dashboard, Team Stats
CREATE INDEX IF NOT EXISTS idx_user_daily_metrics_project_date 
ON user_daily_metrics(project_id, metric_date DESC);

-- Index for queries filtering by user_id and metric_date
-- Used by: User History, Personal Dashboard
CREATE INDEX IF NOT EXISTS idx_user_daily_metrics_user_date 
ON user_daily_metrics(user_id, metric_date DESC);

-- Composite index for queries filtering by both user and project
-- Used by: Detailed user productivity views
CREATE INDEX IF NOT EXISTS idx_user_daily_metrics_user_project_date 
ON user_daily_metrics(user_id, project_id, metric_date DESC);

-- Index for queries filtering by date range
-- Used by: Weekly/Monthly reports
CREATE INDEX IF NOT EXISTS idx_user_daily_metrics_date 
ON user_daily_metrics(metric_date DESC);

-- ============================================================================
-- HISTORY TABLE INDEXES (time tracking - table name is "history")
-- ============================================================================

-- Index for user time entries by date
-- Used by: Time tracking, history views
CREATE INDEX IF NOT EXISTS idx_history_user_date 
ON history(user_id, clock_in_at DESC);

-- Index for project-based time tracking
-- Used by: Project time reports
CREATE INDEX IF NOT EXISTS idx_history_project_date 
ON history(project_id, clock_in_at DESC);

-- Index for date range queries
-- Used by: Weekly/Monthly time reports
CREATE INDEX IF NOT EXISTS idx_history_clock_in 
ON history(clock_in_at DESC);

-- Index for sheet_date (common filter)
CREATE INDEX IF NOT EXISTS idx_history_sheet_date 
ON history(sheet_date DESC);

-- Partial index for "current session" / active clock-in lookup (clock_out_at IS NULL)
-- Used by: GET /time/current, GET /time/home, clock-in validation
CREATE INDEX IF NOT EXISTS idx_history_user_active_session 
ON history(user_id) 
WHERE clock_out_at IS NULL;

-- ============================================================================
-- PROJECT_MEMBERS TABLE INDEXES
-- ============================================================================

-- Index for active project members
-- Used by: Project Resource Allocation, Team Stats
CREATE INDEX IF NOT EXISTS idx_project_members_project_active 
ON project_members(project_id, is_active) 
WHERE is_active = true;

-- Index for user's project memberships
-- Used by: User dashboard, navigation
CREATE INDEX IF NOT EXISTS idx_project_members_user_active 
ON project_members(user_id, is_active) 
WHERE is_active = true;

-- Index for date-based queries (assignment period)
-- Used by: Historical views, assignment tracking
CREATE INDEX IF NOT EXISTS idx_project_members_dates 
ON project_members(project_id, assigned_from, assigned_to);

-- Index for work role filtering
-- Used by: Role-based filtering in dashboards
CREATE INDEX IF NOT EXISTS idx_project_members_work_role 
ON project_members(project_id, work_role) 
WHERE is_active = true;

-- ============================================================================
-- ATTENDANCE_DAILY TABLE INDEXES
-- ============================================================================

-- Index for user attendance lookups by date
-- Used by: Daily attendance tracking, status checks
CREATE INDEX IF NOT EXISTS idx_attendance_daily_user_date 
ON attendance_daily(user_id, attendance_date DESC);

-- Index for date-based attendance queries
-- Used by: Daily attendance reports
CREATE INDEX IF NOT EXISTS idx_attendance_daily_date 
ON attendance_daily(attendance_date DESC);

-- Index for status-based queries
-- Used by: Present/Absent counts
CREATE INDEX IF NOT EXISTS idx_attendance_daily_date_status 
ON attendance_daily(attendance_date DESC, status);

-- ============================================================================
-- USERS TABLE INDEXES
-- ============================================================================

-- Index for active users lookup
-- Used by: User lists, dropdowns
CREATE INDEX IF NOT EXISTS idx_users_active 
ON users(is_active) 
WHERE is_active = true;

-- Index for role-based queries
-- Used by: Admin dashboards, role filtering
CREATE INDEX IF NOT EXISTS idx_users_role_active 
ON users(role, is_active);

-- Index for RPM (Reporting Manager) relationships
-- Used by: Manager views, team hierarchies
CREATE INDEX IF NOT EXISTS idx_users_rpm 
ON users(rpm_user_id) 
WHERE rpm_user_id IS NOT NULL;

-- Index for created_at ordering (CRITICAL for /admin/users endpoint)
-- Used by: User lists with pagination
CREATE INDEX IF NOT EXISTS idx_users_created_at 
ON users(created_at DESC);

-- Index for email lookups (CRITICAL for /me endpoint and get_current_user)
-- Used by: Authentication, user lookups by email
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- ============================================================================
-- PROJECTS TABLE INDEXES
-- ============================================================================

-- Index for active projects
-- Used by: Project lists, dropdowns
CREATE INDEX IF NOT EXISTS idx_projects_active 
ON projects(is_active, name);

-- ============================================================================
-- ATTENDANCE_REQUESTS TABLE INDEXES
-- ============================================================================

-- Index for pending approval requests
-- Used by: Approval workflows
CREATE INDEX IF NOT EXISTS idx_attendance_requests_status 
ON attendance_requests(status, requested_at DESC) 
WHERE status = 'PENDING';

-- Index for user's leave requests
-- Used by: User history, leave balance
CREATE INDEX IF NOT EXISTS idx_attendance_requests_user_date 
ON attendance_requests(user_id, start_date DESC);

-- Index for date range leave queries
-- Used by: Leave calendar, overlapping leaves
CREATE INDEX IF NOT EXISTS idx_attendance_requests_date_range 
ON attendance_requests(start_date, end_date, status);
