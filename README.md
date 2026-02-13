# React Port Dashboard

React + Vite frontend for admin and user productivity workflows, migrated from Streamlit.

## Features

### Role-Based Access (RBAC)

- **ADMIN**
  - Home
  - Project Productivity Dashboard
  - User Productivity Dashboard (**admin only**)
  - Project Resource Allocation
  - Time Sheet Approvals
  - Attendance Approvals
  - Admin Projects
  - Reports Center
- **MANAGER**
  - Home
  - Project Productivity Dashboard
  - Project Resource Allocation
  - Time Sheet Approvals
  - Attendance Approvals
  - Admin Projects
  - Reports Center
- **USER**
  - Home (clock in/out workflow)
  - Team stats
  - Leave/WFH Requests
  - History

### UI

- Built with shadcn + Tailwind-based components
- Searchable comboboxes for project/user/weekoff selectors
- Confirmation drawers/dialogs for destructive actions
- Tables, filters, tabs, cards, and KPI blocks across pages

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

## Installation

1. Go to project root:

```bash
cd react_port
```

2. Install dependencies:

```bash
npm install
```

## Environment Variables (`.env`)

Create `.env` in project root:

```env
VITE_API_BASE_URL=https://your-backend-url
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_REDIRECT_URL=http://localhost:5173
```

### Variable details

- `VITE_API_BASE_URL`: backend base URL (FastAPI/ngrok/local)
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase public anon key
- `VITE_REDIRECT_URL` (optional): OAuth callback target; if omitted, app uses current origin/path

## Run

### Development

```bash
npm run dev
```

App runs on `http://localhost:5173` by default.

### Production build

```bash
npm run build
npm run preview
```

## Authentication Flow

- Login uses Google OAuth via Supabase.
- On sign-in, app exchanges OAuth code and calls backend `/me` to sync role.
- Role controls sidebar and route behavior.
- If user email is not present in backend DB, access is denied.

## Backend Endpoint Expectations

The frontend expects these key endpoints (non-exhaustive):

- Auth/Profile: `GET /me`, `GET /me/`
- User home time tracking:
  - `GET /time/current`
  - `GET /time/history?start_date=...&end_date=...`
  - `POST /time/clock-in`
  - `PUT /time/clock-out`
- Requests:
  - `GET /attendance/requests`
  - `POST /attendance/requests/`
  - `DELETE /attendance/requests/{id}`
- Admin/reporting endpoints under `/admin/*` and `/reports/*`

Note: user home intentionally uses `/time/current` + `/time/history` (not `/time/home`).

## Project Structure

```text
src/
  components/
    Layout.jsx                 # Routing + role-aware sidebar
    UserHome.jsx               # USER home (clock in/out)
    AttendanceRequests.jsx     # Leave/WFH Requests
    TeamStats.jsx              # Team stats
    UserHistory.jsx            # History
    Dashboard.jsx              # Admin project dashboard
    UserDashboard.jsx          # Admin-only user dashboard
    ...
  contexts/
    AuthContext.jsx            # Auth + role sync
  utils/
    api.js                     # API wrappers + request handling
```

## Troubleshooting

- **401/403**: verify token validity and backend user registration.
- **CORS/network issues**: verify `VITE_API_BASE_URL`, backend up status, and ngrok URL.
- **OAuth redirect issues**: verify Supabase redirect URL list and `VITE_REDIRECT_URL`.
- **Env not loading**: ensure `.env` is in root and restart dev server.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run preview` - preview production build
