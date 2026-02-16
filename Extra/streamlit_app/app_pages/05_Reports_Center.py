import streamlit as st
import requests
import pandas as pd
import os
from datetime import date, timedelta
import io
from role_guard import get_user_role
from utils.timezone import today_ist

# --- CONFIG ---
API_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

st.set_page_config(page_title="Reports Center", layout="wide")

# Basic role check
role = get_user_role()
if not role or role not in ["ADMIN", "MANAGER"]:
    st.error("Access denied. Admin or Manager role required.")
    st.stop()
st.title("📂 Reports Command Center")

# --- 1. AUTH CHECK ---
token = st.session_state.get("token")
if not token:
    st.warning("🔒 Please login first.")
    st.stop()

headers = {"Authorization": f"Bearer {token}"}

# --- 2. PRE-FETCH DATA ---
projects = []
users = []

try:
    p_res = requests.get(f"{API_URL}/admin/projects/", headers=headers)
    if p_res.status_code == 200:
        projects = p_res.json()
    
    u_res = requests.get(f"{API_URL}/auth/users/", headers=headers) 
    if u_res.status_code != 200:
        u_res = requests.get(f"{API_URL}/admin/users/", headers=headers)
    
    if u_res.status_code == 200:
        users = u_res.json()

except Exception as e:
    st.error(f"Connection Error: {e}")
    st.stop()

project_map = {p["name"]: p["id"] for p in projects}

# --- 3. REPORT TABS ---
tab1, tab2, tab3 = st.tabs(["📅 Daily Roster", "🏆 Project History", "👤 User Review"])

# ==========================================
# TAB 1: DAILY ROSTER (Preview Enabled)
# ==========================================
with tab1:
    st.subheader("Daily Attendance & Role Roster")
    
    # Project selection
    project_options = ["All Projects"] + list(project_map.keys())
    r_proj_name = st.selectbox("Select Project", project_options, key="r_proj")
    
    # Date range selection
    c1, c2 = st.columns(2)
    with c1:
        r_start_date = st.date_input("From Date", today_ist(), key="r_start_date")
    with c2:
        r_end_date = st.date_input("To Date", today_ist(), key="r_end_date")
    
    # Validate date range
    if r_start_date > r_end_date:
        st.error("'From Date' cannot be after 'To Date'")
    else:
        # 1. Preview Button
        if st.button("🔎 Preview Roster"):
            url = f"{API_URL}/reports/role-drilldown"
            params = {
                "start_date": str(r_start_date),
                "end_date": str(r_end_date)
            }
            
            # Add project_id only if a specific project is selected
            if r_proj_name != "All Projects":
                r_proj_id = project_map[r_proj_name]
                params["project_id"] = r_proj_id
            
            try:
                res = requests.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    # 2. Show Table
                    df = pd.read_csv(io.BytesIO(res.content))
                    st.dataframe(df, use_container_width=True)
                    
                    # 3. Show Download Button
                    file_name_prefix = "All_Projects" if r_proj_name == "All Projects" else r_proj_name
                    date_suffix = f"{r_start_date}_to_{r_end_date}" if r_start_date != r_end_date else str(r_start_date)
                    st.download_button(
                        label="📥 Download CSV",
                        data=res.content,
                        file_name=f"Roster_{file_name_prefix}_{date_suffix}.csv",
                        mime="text/csv",
                        type="primary"
                    )
                else:
                    st.error(f"Failed to fetch data: {res.text}")
            except Exception as e:
                st.error(f"Error: {e}")

# ==========================================
# TAB 2: PROJECT HISTORY (Preview Enabled)
# ==========================================
with tab2:
    st.subheader("Project Hall of Fame")
    h_proj_name = st.selectbox("Select Project", list(project_map.keys()), key="h_proj")
    
    # Date range selection
    c1, c2 = st.columns(2)
    with c1:
        h_start_date = st.date_input("From Date", today_ist() - timedelta(days=30), key="h_start_date")
    with c2:
        h_end_date = st.date_input("To Date", today_ist(), key="h_end_date")
    
    # Validate date range
    if h_start_date > h_end_date:
        st.error("'From Date' cannot be after 'To Date'")
    else:
        if st.button("🔎 Preview History"):
            h_proj_id = project_map[h_proj_name]
            url = f"{API_URL}/reports/project-history"
            params = {
                "project_id": h_proj_id,
                "start_date": str(h_start_date),
                "end_date": str(h_end_date)
            }
            
            try:
                res = requests.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    try:
                        df = pd.read_csv(io.BytesIO(res.content))
                        st.dataframe(df, use_container_width=True)
                        date_suffix = f"{h_start_date}_to_{h_end_date}"
                        st.download_button(
                            label="📥 Download CSV",
                            data=res.content,
                            file_name=f"History_{h_proj_name}_{date_suffix}.csv",
                            mime="text/csv",
                            type="primary"
                        )
                    except pd.errors.EmptyDataError:
                        st.warning("No data found for this project history in the selected date range.")
                else:
                    st.error(f"Failed to fetch data: {res.text}")
            except Exception as e:
                st.error(f"Error: {e}")

# ==========================================
# TAB 3: USER PERFORMANCE REVIEW (Preview Enabled)
# ==========================================
with tab3:
    st.subheader("Individual Performance Review")
    
    if not users:
        st.warning("No users found.")
    else:
        user_display_list = [f"{u['name']} ({u['email']})" for u in users]
        user_selection_map = {f"{u['name']} ({u['email']})": u['id'] for u in users}
        
        selected_user_str = st.selectbox("Select User", user_display_list)
        
        c1, c2 = st.columns(2)
        with c1:
            start_d = st.date_input("Start Date", today_ist() - timedelta(days=30))
        with c2:
            end_d = st.date_input("End Date", today_ist())
            
        if st.button("🔎 Preview Performance"):
            u_id = user_selection_map[selected_user_str]
            url = f"{API_URL}/reports/user-performance"
            params = {
                "user_id": u_id,
                "start_date": str(start_d),
                "end_date": str(end_d)
            }
            
            try:
                res = requests.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    try:
                        df = pd.read_csv(io.BytesIO(res.content))
                        st.dataframe(df, use_container_width=True)
                        st.download_button(
                            label=f"📥 Download Report",
                            data=res.content,
                            file_name=f"Review_{selected_user_str.split('(')[0]}_{start_d}.csv",
                            mime="text/csv",
                            type="primary"
                        )
                    except pd.errors.EmptyDataError:
                        st.warning("No performance data found for this period.")
                else:
                    st.error(f"Failed: {res.text}")
            except Exception as e:
                st.error(f"Error: {e}")