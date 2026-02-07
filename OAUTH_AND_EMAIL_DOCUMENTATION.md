# OAuth and Email Logic - Technical Documentation

## Overview

This document provides a comprehensive explanation of the OAuth authentication flow and email notification system used in the Resource Management application. The system uses **Supabase OAuth** for authentication (Google OAuth) and **Resend** (via Supabase Edge Functions) for email notifications.

---

## Table of Contents

1. [OAuth Authentication Flow](#oauth-authentication-flow)
2. [Email Notification System](#email-notification-system)
3. [Environment Variables](#environment-variables)
4. [Code Flow Diagrams](#code-flow-diagrams)
5. [Error Handling](#error-handling)
6. [Development Mode (Auth Bypass)](#development-mode-auth-bypass)

---

## OAuth Authentication Flow

### Architecture Overview

The application uses **Supabase Authentication** with **Google OAuth** as the primary authentication method. The flow involves:

1. **Frontend (Streamlit)**: Initiates OAuth login
2. **Supabase**: Handles OAuth with Google
3. **Backend (FastAPI)**: Validates tokens and authorizes users
4. **Database (PostgreSQL)**: Stores user information and roles

### Components

#### 1. Frontend Authentication (`streamlit_app/auth.py`)

**File**: `resource-management/streamlit_app/auth.py`

##### Login UI Function (`login_ui()`)

**Purpose**: Displays login page and handles OAuth callback

**Flow**:

1. **Check for OAuth Callback**:
   ```python
   code = st.query_params.get("code")
   if code:
       # Exchange code for session
       res = supabase.auth.exchange_code_for_session({"auth_code": code})
   ```

2. **Extract User Information**:
   ```python
   token = res.session.access_token
   st.session_state["token"] = token
   st.session_state["user_email"] = res.user.email
   st.session_state["user_id"] = res.user.id
   st.session_state["user_name"] = res.user.user_metadata.get("name", "")
   st.session_state["user_avatar"] = res.user.user_metadata.get("avatar_url")
   ```

3. **Sync Role from Backend**:
   ```python
   if _sync_role_from_backend(token):
       # User authorized - continue
   else:
       # User not authorized - clear session
   ```

4. **Generate OAuth URL** (if no callback):
   ```python
   result = supabase.auth.sign_in_with_oauth({
       "provider": "google",
       "options": {"redirect_to": redirect_to},
   })
   ```

**Key Functions**:

- `login_ui()`: Main login page handler
- `_sync_role_from_backend(token)`: Validates token with backend and syncs user role
- `require_auth()`: Checks if user is authenticated (called at top of every page)
- `logout()`: Clears session state

##### Role Synchronization (`_sync_role_from_backend()`)

**Purpose**: Validates token with backend API and retrieves user role

**Flow**:

1. **Make API Request**:
   ```python
   api_base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
   headers = {"Authorization": f"Bearer {token}"}
   response = requests.get(f"{api_base_url}/me/", headers=headers, timeout=5)
   ```

2. **Handle Response**:
   - **200 OK**: User exists and is authorized
     - Store user data in session state
     - Set user role from backend
   - **403 Forbidden**: User email not registered in database
     - Show error message
     - Clear session
   - **Other**: Authentication failed
     - Clear session

**Code Location**: Lines 35-56 in `streamlit_app/auth.py`

---

#### 2. Backend Authentication (`app/core/dependencies.py`)

**File**: `resource-management/app/core/dependencies.py`

##### Token Validation (`get_current_user()`)

**Purpose**: Validates Supabase token and retrieves user from database

**Flow** (when `DISABLE_AUTH=false`):

1. **Extract Token**:
   ```python
   authorization: str = Header(...)
   if not authorization.startswith("Bearer "):
       raise HTTPException(401, "Invalid Authorization header")
   token = authorization.replace("Bearer ", "")
   ```

2. **Validate with Supabase**:
   ```python
   supabase_user = get_user_from_token(token)
   ```

3. **Find User in Database**:
   ```python
   user = db.query(User).filter(User.email == supabase_user.email).first()
   ```

4. **Authorization Checks**:
   - **User Not Found**: Return 403 Forbidden
   - **User Inactive**: Return 403 Forbidden
   - **User Active**: Return user object

**Code Location**: Lines 67-109 in `app/core/dependencies.py`

---

#### 3. Supabase Auth Module (`app/core/supabase_auth.py`)

**File**: `resource-management/app/core/supabase_auth.py`

##### Get User from Token (`get_user_from_token()`)

**Purpose**: Validates Supabase access token and returns user information

**Flow**:

1. **Check Auth Mode**:
   ```python
   if DISABLE_AUTH:
       raise RuntimeError("Supabase auth is disabled")
   ```

2. **Validate Token**:
   ```python
   response = supabase.auth.get_user(token)
   ```

3. **Return User**:
   ```python
   if not response or not response.user:
       raise HTTPException(401, "Invalid Supabase token")
   return response.user
   ```

**Code Location**: Lines 24-50 in `app/core/supabase_auth.py`

---

### OAuth Flow Diagram

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Click "Login with Google"
       ▼
┌─────────────────────┐
│  Streamlit App      │
│  (login_ui)         │
└──────┬──────────────┘
       │
       │ 2. Generate OAuth URL
       │    supabase.auth.sign_in_with_oauth()
       ▼
┌─────────────────────┐
│   Supabase Auth     │
│   (Google OAuth)    │
└──────┬──────────────┘
       │
       │ 3. Redirect to Google
       ▼
┌─────────────────────┐
│   Google OAuth      │
│   (User Login)      │
└──────┬──────────────┘
       │
       │ 4. Redirect back with code
       │    ?code=xxx&state=yyy
       ▼
┌─────────────────────┐
│  Streamlit App      │
│  (OAuth Callback)   │
└──────┬──────────────┘
       │
       │ 5. Exchange code for session
       │    supabase.auth.exchange_code_for_session()
       ▼
┌─────────────────────┐
│   Supabase Auth     │
│   (Returns token)   │
└──────┬──────────────┘
       │
       │ 6. Store token in session
       │    st.session_state["token"] = token
       ▼
┌─────────────────────┐
│  Streamlit App      │
│  (_sync_role_from_  │
│   _backend)         │
└──────┬──────────────┘
       │
       │ 7. Validate token with backend
       │    GET /me/ (with Bearer token)
       ▼
┌─────────────────────┐
│  FastAPI Backend    │
│  (get_current_user) │
└──────┬──────────────┘
       │
       │ 8. Validate with Supabase
       │    supabase.auth.get_user(token)
       ▼
┌─────────────────────┐
│   Supabase Auth     │
│   (Token Validation)│
└──────┬──────────────┘
       │
       │ 9. Return user email
       ▼
┌─────────────────────┐
│  FastAPI Backend    │
│  (Database Query)   │
└──────┬──────────────┘
       │
       │ 10. Find user by email
       │     db.query(User).filter(email=...)
       ▼
┌─────────────────────┐
│  PostgreSQL DB      │
│  (users table)      │
└──────┬──────────────┘
       │
       │ 11. Return user with role
       ▼
┌─────────────────────┐
│  Streamlit App      │
│  (Store role)       │
│  User logged in!    │
└─────────────────────┘
```

---

### Session State Management

After successful authentication, the following data is stored in Streamlit session state:

```python
st.session_state["token"] = "supabase_access_token"
st.session_state["user_email"] = "user@example.com"
st.session_state["user_id"] = "uuid"
st.session_state["user_name"] = "User Name"
st.session_state["user_role"] = "USER" | "ADMIN" | "MANAGER"
st.session_state["user_avatar"] = "https://..." (optional)
```

**Usage**: All subsequent API requests include the token in the Authorization header:
```python
headers = {"Authorization": f"Bearer {st.session_state['token']}"}
```

---

## Email Notification System

### Architecture Overview

The email notification system uses:

1. **Backend Service** (`app/services/notification_service.py`): Initiates email sending
2. **Supabase Edge Function** (`supabase/functions/send-approval-email/`): Receives email requests
3. **Resend API**: Actually sends the emails

### Components

#### 1. Notification Service (`app/services/notification_service.py`)

**File**: `resource-management/app/services/notification_service.py`

##### Send Decision Email (`send_attendance_request_decision_email()`)

**Purpose**: Sends email notification for attendance request decisions (APPROVED, REJECTED, REQUESTED)

**Parameters**:
- `user_email`: Recipient email address
- `user_name`: Recipient name
- `decision`: "APPROVED", "REJECTED", or "REQUESTED"
- `comment`: Optional comment/reason
- `request_type`: Type of request (LEAVE, WFH, SICK_LEAVE, etc.)
- `start_date`: Request start date
- `end_date`: Request end date
- `requester_name`: Optional requester name (for REQUESTED)
- `project_names`: Optional project names

**Flow**:

1. **Check Environment Variables**:
   ```python
   supabase_url = os.getenv("SUPABASE_URL")
   service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
   if not supabase_url or not service_role_key:
       print("[EMAIL] Skipped - Missing env vars")
       return
   ```

2. **Prepare Payload**:
   ```python
   function_url = f"{supabase_url}/functions/v1/send-approval-email"
   payload = {
       "email": user_email,
       "name": user_name,
       "decision": decision,
       "comment": comment or "",
       "request_type": request_type,
       "start_date": start_date,
       "end_date": end_date,
   }
   ```

3. **Send Request to Supabase Edge Function**:
   ```python
   headers = {
       "Authorization": f"Bearer {service_role_key}",
       "Content-Type": "application/json",
   }
   response = requests.post(function_url, json=payload, headers=headers, timeout=10)
   ```

**Code Location**: Lines 7-53 in `app/services/notification_service.py`

##### Send Request Created Email (`send_attendance_request_created_email()`)

**Purpose**: Wrapper function to send notification when a new attendance request is created

**Flow**:
- Calls `send_attendance_request_decision_email()` with `decision="REQUESTED"`

**Code Location**: Lines 56-77 in `app/services/notification_service.py`

---

#### 2. Supabase Edge Function (`supabase/functions/send-approval-email/index.ts`)

**File**: `resource-management/supabase/functions/send-approval-email/index.ts`

**Purpose**: Receives email requests from backend and sends emails via Resend API

**Flow**:

1. **Validate Environment Variables**:
   ```typescript
   const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
   const FROM_EMAIL = Deno.env.get("FROM_EMAIL");
   if (!RESEND_API_KEY || !FROM_EMAIL) {
       return new Response("Missing RESEND_API_KEY or FROM_EMAIL", { status: 500 });
   }
   ```

2. **Parse Request Body**:
   ```typescript
   const body = await req.json();
   const { email, name, decision, comment, request_type, start_date, end_date, requester_name, project_names } = body;
   ```

3. **Generate Email Content**:
   - **Subject Line**: Based on decision type
     - `"New attendance request submitted"` (REQUESTED)
     - `"Your attendance request was approved"` (APPROVED)
     - `"Your attendance request was rejected"` (REJECTED)
   - **HTML Body**: Formatted email with request details

4. **Send Email via Resend**:
   ```typescript
   const resendResponse = await fetch("https://api.resend.com/emails", {
       method: "POST",
       headers: {
           "Authorization": `Bearer ${RESEND_API_KEY}`,
           "Content-Type": "application/json",
       },
       body: JSON.stringify({
           from: FROM_EMAIL,
           to: email,
           subject: subject,
           html: html,
       }),
   });
   ```

**Code Location**: Lines 1-83 in `supabase/functions/send-approval-email/index.ts`

---

### Email Flow Diagram

```
┌─────────────────────┐
│  User Action        │
│  (Create/Approve/   │
│   Reject Request)   │
└──────┬──────────────┘
       │
       │ 1. API Endpoint Called
       ▼
┌─────────────────────┐
│  FastAPI Backend    │
│  (requests.py or    │
│   approvals.py)     │
└──────┬──────────────┘
       │
       │ 2. Call notification service
       │    send_attendance_request_decision_email()
       ▼
┌─────────────────────┐
│  Notification       │
│  Service            │
│  (notification_     │
│   service.py)       │
└──────┬──────────────┘
       │
       │ 3. POST to Supabase Edge Function
       │    {supabase_url}/functions/v1/send-approval-email
       │    (with service_role_key)
       ▼
┌─────────────────────┐
│  Supabase Edge      │
│  Function           │
│  (send-approval-    │
│   email/index.ts)   │
└──────┬──────────────┘
       │
       │ 4. Generate email HTML
       │    Format subject, body, etc.
       ▼
┌─────────────────────┐
│  Resend API         │
│  (api.resend.com)   │
└──────┬──────────────┘
       │
       │ 5. Send email
       ▼
┌─────────────────────┐
│  User's Email        │
│  Inbox               │
└─────────────────────┘
```

---

### Email Triggers

#### 1. New Attendance Request Created

**Trigger**: When a user creates a new attendance request

**Endpoint**: `POST /attendance/requests/`

**Recipients**:
- **Reporting Manager (RPM)**: User's `rpm_user_id` (if exists)
- **Project Owners**: All owners of projects where user is a member

**Code Location**: Lines 53-96 in `app/api/attendance/requests.py`

**Email Details**:
- **Decision**: "REQUESTED"
- **Subject**: "New attendance request submitted"
- **Content**: Includes requester name, request type, dates, reason, project names

---

#### 2. Attendance Request Approved

**Trigger**: When a manager approves an attendance request

**Endpoint**: `POST /admin/attendance-request-approvals/`

**Recipients**:
- **Requester**: User who created the request

**Code Location**: Lines 95-112 in `app/api/admin/attendance_request_approvals.py`

**Email Details**:
- **Decision**: "APPROVED"
- **Subject**: "Your attendance request was approved"
- **Content**: Includes request type, dates, comment (if any), project names

**Additional Actions**:
- Updates `attendance_requests.status` to "APPROVED"
- Creates/updates `attendance_daily` record with status "LEAVE" or "PRESENT"

---

#### 3. Attendance Request Rejected

**Trigger**: When a manager rejects an attendance request

**Endpoint**: `POST /admin/attendance-request-approvals/`

**Recipients**:
- **Requester**: User who created the request

**Code Location**: Lines 95-112 in `app/api/admin/attendance_request_approvals.py`

**Email Details**:
- **Decision**: "REJECTED"
- **Subject**: "Your attendance request was rejected"
- **Content**: Includes request type, dates, comment (rejection reason), project names

**Additional Actions**:
- Updates `attendance_requests.status` to "REJECTED"

---

### Email Template Structure

The email HTML template includes:

```html
<div style="font-family: Arial, sans-serif;">
  <p>Hi {name},</p>
  <p>{decisionLine}</p>
  {projectLine}  <!-- If project_names provided -->
  <p><strong>Type:</strong> {request_type}</p>
  <p><strong>Dates:</strong> {start_date} to {end_date}</p>
  {commentLine}  <!-- If comment provided -->
  <p>Regards,<br/>Resource Management</p>
</div>
```

**Dynamic Content**:
- **Decision Line**: Changes based on decision type
- **Project Line**: Only shown if `project_names` is provided
- **Comment Line**: Only shown if `comment` is provided

---

## Environment Variables

### OAuth Authentication

#### Frontend (Streamlit)

**File**: `.env` in `resource-management/streamlit_app/` or project root

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# OAuth Redirect URL
SUPABASE_REDIRECT_URL=http://localhost:8501  # For local development
# SUPABASE_REDIRECT_URL=https://your-domain.com  # For production

# Backend API URL
API_BASE_URL=http://127.0.0.1:8000

# Auth Toggle (for development)
DISABLE_AUTH=false  # Set to true to bypass authentication
```

#### Backend (FastAPI)

**File**: `.env` in project root

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Auth Toggle
DISABLE_AUTH=false  # Set to true to bypass authentication
```

---

### Email Notifications

#### Backend (FastAPI)

**File**: `.env` in project root

```bash
# Supabase Configuration (for Edge Function)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Supabase Edge Function

**Environment Variables** (set in Supabase Dashboard → Functions → send-approval-email → Settings):

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx  # Resend API key
FROM_EMAIL=noreply@yourdomain.com  # Verified sender email
```

**Note**: The `FROM_EMAIL` must be verified in your Resend account.

---

## Code Flow Diagrams

### Complete OAuth Login Flow

```
User clicks "Login with Google"
    │
    ├─► Streamlit: login_ui()
    │   └─► Generate OAuth URL
    │       └─► supabase.auth.sign_in_with_oauth()
    │
    ├─► Redirect to Google OAuth
    │   └─► User authenticates with Google
    │
    ├─► Google redirects back with code
    │   └─► ?code=xxx&state=yyy
    │
    ├─► Streamlit: Handle callback
    │   └─► supabase.auth.exchange_code_for_session()
    │       └─► Get access token
    │
    ├─► Streamlit: Store token in session
    │   └─► st.session_state["token"] = token
    │
    ├─► Streamlit: Sync role from backend
    │   └─► GET /me/ (with Bearer token)
    │
    ├─► Backend: get_current_user()
    │   └─► Validate token with Supabase
    │       └─► supabase.auth.get_user(token)
    │
    ├─► Backend: Find user in database
    │   └─► db.query(User).filter(email=...)
    │
    └─► Backend: Return user data
        └─► Streamlit: Store role
            └─► User logged in!
```

---

### Complete Email Notification Flow

```
User creates/approves/rejects attendance request
    │
    ├─► API Endpoint Called
    │   ├─► POST /attendance/requests/ (create)
    │   └─► POST /admin/attendance-request-approvals/ (approve/reject)
    │
    ├─► Backend: Process request
    │   └─► Save to database
    │
    ├─► Backend: Determine recipients
    │   ├─► For CREATE: RPM + Project Owners
    │   └─► For APPROVE/REJECT: Requester
    │
    ├─► Backend: Call notification service
    │   └─► send_attendance_request_decision_email()
    │
    ├─► Notification Service: Prepare payload
    │   └─► Include email, name, decision, details
    │
    ├─► Notification Service: POST to Supabase Edge Function
    │   └─► {supabase_url}/functions/v1/send-approval-email
    │       └─► Authorization: Bearer {service_role_key}
    │
    ├─► Supabase Edge Function: Receive request
    │   └─► Parse payload
    │
    ├─► Supabase Edge Function: Generate email HTML
    │   └─► Format subject, body, etc.
    │
    ├─► Supabase Edge Function: POST to Resend API
    │   └─► https://api.resend.com/emails
    │       └─► Authorization: Bearer {RESEND_API_KEY}
    │
    └─► Resend: Send email
        └─► Email delivered to recipient
```

---

## Error Handling

### OAuth Errors

#### 1. Invalid Token

**Scenario**: Token is expired or invalid

**Handling**:
- Backend: Returns 401 Unauthorized
- Frontend: Clears session and redirects to login

**Code Location**: `app/core/supabase_auth.py` lines 46-50

---

#### 2. User Not Registered

**Scenario**: User authenticated with Google but email not in database

**Handling**:
- Backend: Returns 403 Forbidden
- Frontend: Shows error message "Access denied. Your email is not registered in the system."
- Frontend: Clears session

**Code Location**: 
- Backend: `app/core/dependencies.py` lines 90-94
- Frontend: `streamlit_app/auth.py` lines 50-52

---

#### 3. User Inactive

**Scenario**: User exists but `is_active = false`

**Handling**:
- Backend: Returns 403 Forbidden
- Frontend: Clears session

**Code Location**: `app/core/dependencies.py` lines 96-100

---

#### 4. OAuth Callback Error

**Scenario**: Google OAuth returns error in callback

**Handling**:
- Frontend: Checks `st.query_params.get("error")`
- Frontend: Displays error message to user

**Code Location**: `streamlit_app/auth.py` lines 126-130

---

### Email Errors

#### 1. Missing Environment Variables

**Scenario**: `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set

**Handling**:
- Notification service: Logs warning and returns early
- Email is not sent (non-blocking)

**Code Location**: `app/services/notification_service.py` lines 22-24

---

#### 2. Supabase Edge Function Error

**Scenario**: Edge function fails or returns error

**Handling**:
- Notification service: Catches exception and logs error
- Email is not sent (non-blocking)
- Request processing continues (doesn't fail the API call)

**Code Location**: `app/services/notification_service.py` lines 48-52

---

#### 3. Resend API Error

**Scenario**: Resend API fails (invalid API key, unverified email, etc.)

**Handling**:
- Edge function: Returns 500 error
- Notification service: Logs error response
- Email is not sent (non-blocking)

**Code Location**: `supabase/functions/send-approval-email/index.ts` lines 77-79

---

## Development Mode (Auth Bypass)

### Overview

For development convenience, authentication can be bypassed by setting `DISABLE_AUTH=true` in the environment variables.

### How It Works

#### Frontend (`streamlit_app/auth.py`)

**When `DISABLE_AUTH=true`**:

1. **Login UI**:
   ```python
   if DISABLE_AUTH:
       st.info("🔓 Auth is disabled - Click below to continue")
       if st.button("Continue"):
           st.session_state["token"] = "bypass_token"
           st.session_state["user_email"] = "admin@local.dev"
           st.session_state["user_id"] = "local-admin"
           st.session_state["user_name"] = "Local Admin"
           st.session_state["user_role"] = "ADMIN"
   ```

2. **Require Auth**:
   ```python
   if DISABLE_AUTH:
       if "token" not in st.session_state:
           st.session_state["token"] = "bypass_token"
           # ... set default user data
   ```

**Code Location**: Lines 132-141, 216-222 in `streamlit_app/auth.py`

---

#### Backend (`app/core/dependencies.py`)

**When `DISABLE_AUTH=true`**:

1. **Get Current User**:
   ```python
   if DISABLE_AUTH:
       def get_current_user(db: Session = Depends(get_db)) -> User:
           user = db.query(User).filter(User.email == "admin@local.dev").first()
           if not user:
               # Create default admin user
               user = User(
                   id=uuid.uuid4(),
                   email="admin@local.dev",
                   name="Local Admin",
                   role=UserRole.ADMIN,
                   is_active=True,
                   doj=date.today(),
               )
               db.add(user)
               db.commit()
           return user
   ```

**Code Location**: Lines 41-62 in `app/core/dependencies.py`

---

#### Supabase Client (`streamlit_app/supabase_client.py`)

**When `DISABLE_AUTH=true`**:
- Supabase client is not initialized
- `supabase = None`

**Code Location**: Lines 21-37 in `streamlit_app/supabase_client.py`

---

### Important Notes

1. **Security**: Never use `DISABLE_AUTH=true` in production
2. **Database**: The bypass mode creates/uses a user with email `admin@local.dev`
3. **Token**: Uses `"bypass_token"` as the token (not validated)
4. **Role**: Default role is `ADMIN` for full access

---

## Security Considerations

### OAuth Security

1. **Token Storage**: Tokens are stored in Streamlit session state (in-memory, cleared on logout)
2. **Token Validation**: Every API request validates the token with Supabase
3. **User Authorization**: Users must exist in database (email-based lookup)
4. **Role-Based Access**: User roles are stored in database and checked per endpoint

### Email Security

1. **Service Role Key**: Only backend uses service role key (never exposed to frontend)
2. **Edge Function**: Protected by Supabase service role key
3. **Resend API Key**: Stored securely in Supabase Edge Function environment variables
4. **Email Validation**: Resend validates sender email domain

---

## Troubleshooting

### OAuth Issues

#### "Could not generate login URL"
- **Cause**: Supabase client not initialized or invalid credentials
- **Solution**: Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables

#### "Access denied. Your email is not registered"
- **Cause**: User authenticated with Google but email not in database
- **Solution**: Add user to database with matching email address

#### "Invalid or expired token"
- **Cause**: Token expired or invalid
- **Solution**: User needs to log in again

---

### Email Issues

#### "Missing RESEND_API_KEY or FROM_EMAIL"
- **Cause**: Edge function environment variables not set
- **Solution**: Set environment variables in Supabase Dashboard → Functions → Settings

#### "Email skipped - Missing env vars"
- **Cause**: Backend missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`
- **Solution**: Set environment variables in backend `.env` file

#### Emails not being delivered
- **Check**: Resend dashboard for delivery status
- **Check**: Verify sender email is verified in Resend
- **Check**: Check spam folder
- **Check**: Edge function logs in Supabase Dashboard

---

## Summary

### OAuth Flow Summary

1. User clicks "Login with Google"
2. Redirected to Google OAuth
3. Google redirects back with authorization code
4. Code exchanged for Supabase access token
5. Token validated with backend API
6. User data retrieved from database
7. User role stored in session
8. User logged in

### Email Flow Summary

1. User action triggers email (create/approve/reject request)
2. Backend determines recipients
3. Notification service prepares payload
4. Payload sent to Supabase Edge Function
5. Edge function generates email HTML
6. Email sent via Resend API
7. Email delivered to recipient

---

## Related Files

### OAuth Files
- `resource-management/streamlit_app/auth.py` - Frontend authentication
- `resource-management/app/core/dependencies.py` - Backend token validation
- `resource-management/app/core/supabase_auth.py` - Supabase token validation
- `resource-management/streamlit_app/supabase_client.py` - Supabase client initialization

### Email Files
- `resource-management/app/services/notification_service.py` - Email service
- `resource-management/supabase/functions/send-approval-email/index.ts` - Edge function
- `resource-management/app/api/attendance/requests.py` - Request creation (triggers email)
- `resource-management/app/api/admin/attendance_request_approvals.py` - Approvals (triggers email)

---

## Conclusion

This documentation provides a comprehensive overview of the OAuth authentication and email notification systems. The architecture is designed to be secure, scalable, and maintainable, with proper error handling and development mode support.
