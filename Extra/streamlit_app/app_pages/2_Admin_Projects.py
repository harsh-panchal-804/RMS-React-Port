import streamlit as st
import requests
import os
import pandas as pd
import time
from datetime import date, datetime, timedelta
from role_guard import get_user_role
from utils.timezone import today_ist

def clear_team_stats_cache():
    """Clear caches related to team stats and project assignments.
    This ensures that when a person is assigned to a new project, 
    the Team Stats page will show the updated information immediately."""
    # Clear all cached data to ensure Team Stats page gets fresh data
    # This is safe and ensures all related caches are cleared
    st.cache_data.clear()

# --- CONFIGURATION ---
st.set_page_config(page_title="Admin | Project Manager", layout="wide")

# Basic role check
role = get_user_role()
if not role or role not in ["ADMIN", "MANAGER"]:
    st.error("Access denied. Admin or Manager role required.")
    st.stop()
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

ROLE_OPTIONS = ["Panelist", "Quality Check", "Annotation", "Retro Quality Check", "Super Quality Check", "Proctoring", "Operations", "Training",]

# --- HELPER FUNCTIONS ---
# def authenticated_request(method, endpoint, data=None):
#     token = st.session_state.get("token")
#     if not token:
#         st.warning("🔒 Please login first.")
#         st.stop()
#
#     headers = {"Authorization": f"Bearer {token}"}
#     try:
#         response = requests.request(method, f"{API_BASE_URL}{endpoint}", headers=headers, json=data)
#         if response.status_code >= 400:
#             st.error(f"❌ Error {response.status_code}: {response.text}")
#             return None
#         return response.json()
#     except Exception as e:
#         st.error(f"❌ Connection Error: {e}")
#         return None

def authenticated_request(method, endpoint, data=None, uploaded_file=None, params=None):
    token = st.session_state.get("token")
    
    if not token:
        st.warning("🔒 Please login first.")
        st.stop()

    headers = {"Authorization": f"Bearer {token}"}
    
    # enforce ONE payload type
    if data is not None and uploaded_file is not None:
        st.error("❌ Cannot send JSON and file in the same request.")
        return None
     
    url = f"{API_BASE_URL}{endpoint}"

    try:
        response = None
        # for file upload
        if uploaded_file is not None:
            files = {
                "file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)
            }
            with st.spinner("Uploading file..."):
                response = requests.request(method, url, headers=headers, files=files, params=params)
        else:
            # for json payload (POST/PUT) or params (GET)
            if method.upper() == "GET" and params:
                response = requests.request(method, url, headers=headers, params=params)
            else:
                response = requests.request(method, url, headers=headers, json=data, params=params)
        
        if response.status_code >= 400:
            st.error(f"❌ Error {response.status_code}: {response.text}")
            return None
        return response.json()

    except Exception as e:
        st.error(f"❌ Connection Error: {e}")
        return None
    

# --- TITLE ---
st.title("🛠️ Project Management Center")
st.markdown("---")

tab1, tab2, tab3, tab4 = st.tabs(["📂 Manage Projects", "👥 Team Allocations", "⭐ Quality Assessment", "👤 User Management"])

# ==========================================
# TAB 1
# ==========================================
with tab1:

    with st.expander("➕ Create New Project", expanded=False):
        with st.form("create_project_form"):
            c1, c2 = st.columns(2)
            new_name = c1.text_input("Project Name")
            new_code = c2.text_input("Project Code")

            c3, c4, c5 = st.columns(3)
            new_start = c3.date_input("Start Date", value=today_ist())
            new_end = c4.date_input("End Date (Optional)", value=None)
            is_active = c5.checkbox("Is Active?", value=True)
            
            if st.form_submit_button("Create Project", type="primary"):
                payload = {
                    "name": new_name.strip(),
                    "code": new_code.strip(),
                    "start_date": str(new_start),
                    "end_date": str(new_end) if new_end else None,
                    "is_active": is_active
                }
                authenticated_request("POST", "/admin/projects/", data=payload)
                st.toast("Project created")
                st.rerun()
    
    # --- BOTTOM: UPLOAD BULK PROJECTS
    with st.expander("Upload Bulk Project (in .csv)", expanded=False):
        # Download template
        st.markdown("#### 📥 Download CSV Template")
        st.warning("⚠️ **Important:** When opening in Excel, dates may appear in DD-MM-YYYY format. The CSV file contains dates in YYYY-MM-DD format. If editing in Excel, ensure dates are saved as YYYY-MM-DD (e.g., 2024-01-15).")
        # Create CSV with proper YYYY-MM-DD date format
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        # Write header
        writer.writerow(["code", "name", "is_active", "start_date", "end_date"])
        # Write data rows - dates in YYYY-MM-DD format
        writer.writerow(["PROJ001", "Project Name", "true", "2024-01-15", "2024-12-31"])
        writer.writerow(["PROJ002", "Another Project", "true", "2024-06-01", "2024-12-31"])
        csv_template = output.getvalue().encode('utf-8')
        
        st.download_button(
            label="📥 Download Projects CSV Template",
            data=csv_template,
            file_name="projects_template.csv",
            mime="text/csv",
            key="projects_template_download"
        )
        
        st.markdown("---")
        
        uploaded_file = st.file_uploader(
            "Upload a CSV file",
            type=["csv"],
            accept_multiple_files=False
        )

        if uploaded_file:
            if uploaded_file.type != "text/csv" and uploaded_file.type != "application/vnd.ms-excel":
                st.error("Invalid file type. Please upload a .csv file")
            else:
                if uploaded_file.size == 0:
                    st.error("Empty file.")
                else:
                    st.success("File attached.")
                    
                    # Preview the CSV data before upload
                    try:
                        uploaded_file.seek(0)  # Reset file pointer
                        df_preview = pd.read_csv(uploaded_file)
                        st.markdown("#### 📄 CSV Preview")
                        st.dataframe(df_preview, use_container_width=True, hide_index=True)
                        st.caption(f"Total rows: {len(df_preview)}")
                        
                        # Reset file pointer again for upload
                        uploaded_file.seek(0)
                    except Exception as e:
                        st.error(f"❌ Error reading CSV file: {str(e)}")
                        st.stop()
                    
                    if st.button("Upload", type="primary"):
                        response = authenticated_request("POST", "/admin/bulk_uploads/projects", uploaded_file=uploaded_file)
                        
                        if not response:
                            st.error("Error uploading file")
                        else:
                            st.success(f"Inserted: {response['inserted']}")
                            error = response["errors"]
                            if len(error) == 0:
                                st.info("✅ No errors")
                            else:
                                st.warning(f"⚠️ {len(error)} error(s) encountered:")
                                with st.expander("View Errors", expanded=True):
                                    for err in error:
                                        st.text(err)
        else:
            st.warning("Select a file.")

    projects_data = authenticated_request("GET", "/admin/projects/")

    # KPI
    if projects_data:
        total_projects = len(projects_data)
        # Active: is_active=True AND no end_date
        active_projects = len([p for p in projects_data if p["is_active"] and not p.get("end_date")])
        # Paused: is_active=False AND no end_date
        paused_projects = len([p for p in projects_data if not p["is_active"] and not p.get("end_date")])
        # Completed: has end_date (regardless of is_active)
        completed_projects = len([p for p in projects_data if p.get("end_date")])

        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Total Projects", total_projects)
        k2.metric("Active Projects", active_projects)
        k3.metric("Paused Projects", paused_projects)
        k4.metric("Completed Projects", completed_projects)

    st.markdown("---")

    c1, c2 = st.columns([2,1])
    with c1:
        search_text = st.text_input("Search by Code or Name")
    with c2:
        status_filter = st.selectbox("Status Filter", ["ALL", "ACTIVE", "PAUSED", "COMPLETED"])

    filtered_projects = []
    for p in projects_data:
        if search_text and search_text.lower() not in p["name"].lower() and search_text.lower() not in p["code"].lower():
            continue
        # Active: is_active=True AND no end_date
        if status_filter == "ACTIVE" and (not p["is_active"] or p.get("end_date")):
            continue
        # Paused: is_active=False AND no end_date
        if status_filter == "PAUSED" and (p["is_active"] or p.get("end_date")):
            continue
        # Completed: has end_date (regardless of is_active)
        if status_filter == "COMPLETED" and not p.get("end_date"):
            continue
        filtered_projects.append(p)

    if filtered_projects:

        df = pd.DataFrame(filtered_projects)
        df["status"] = df.apply(
            lambda row: "COMPLETED"
            if row.get("end_date")
            else ("ACTIVE" if row.get("is_active") else "PAUSED"),
            axis=1,
        )

        # Fetch all managers (ADMIN + MANAGER role) for the dropdown
        all_managers = authenticated_request("GET", "/admin/users/project_managers") or []
        manager_options = [f"{m['name']}" for m in all_managers]
        manager_name_to_id = {m['name']: m['id'] for m in all_managers}
        manager_id_to_name = {m['id']: m['name'] for m in all_managers}

        members_count = {}
        owners_map = {}  # Maps project_id to list of owner names
        owners_ids_map = {}  # Maps project_id to list of owner user_ids

        for p in projects_data:
            # Get member count
            members = authenticated_request("GET", f"/admin/projects/{p['id']}/members") or []
            members_count[p["id"]] = len(members)
            
            # Get project owners from project_owners table
            owners = authenticated_request("GET", f"/admin/projects/{p['id']}/owners") or []
            owner_names = [o.get("user_name", "Unknown") for o in owners]
            owner_ids = [o.get("user_id") for o in owners]
            owners_map[p["id"]] = owner_names
            owners_ids_map[p["id"]] = owner_ids

        df["allocated_users"] = df["id"].map(members_count)
        df["pm_apm"] = df["id"].map(lambda x: owners_map.get(x, []))

        edit_df = df[['code','name','status','allocated_users','pm_apm','start_date','end_date','id']].copy()
        edit_df['start_date'] = pd.to_datetime(edit_df['start_date']).dt.date
        edit_df['end_date'] = pd.to_datetime(edit_df['end_date']).dt.date

        # Convert pm_apm list to comma-separated string for display (read-only)
        edit_df['pm_apm'] = edit_df['pm_apm'].apply(lambda x: ", ".join(x) if isinstance(x, list) else "")
        
        edited_df = st.data_editor(
            edit_df,
            column_config={
                "id": None,
                "code": st.column_config.TextColumn("Code"),
                "name": st.column_config.TextColumn("Name"),
                "status": st.column_config.SelectboxColumn(
                    "Status",
                    options=["ACTIVE", "PAUSED", "COMPLETED"],
                ),
                "allocated_users": st.column_config.NumberColumn("Allocated Users", disabled=True),
                "pm_apm": st.column_config.TextColumn(
                    "PM / APM",
                    help="Use the section below to assign PM/APM",
                    disabled=True,  # Make it read-only
                ),
                "start_date": st.column_config.DateColumn("Start Date"),
                "end_date": st.column_config.DateColumn("End Date")
            },
            use_container_width=True,
            key="project_editor"
        )

        # PM/APM Assignment Section (since ListColumn is read-only, we need a separate UI)
        st.markdown("---")
        st.markdown("### 👥 Assign PM / APM to Projects")
        st.caption("Select a project and assign managers as owners")
        
        # Track previously selected project to detect changes
        if "prev_pm_assign_project" not in st.session_state:
            st.session_state.prev_pm_assign_project = None
        
        col_proj, col_managers = st.columns([1, 2])
        
        with col_proj:
            project_options = {p["name"]: p["id"] for p in filtered_projects}
            # Add a placeholder option for "Select a project"
            project_names_list = ["-- Select a Project --"] + list(project_options.keys())
            
            selected_project_name = st.selectbox(
                "Select Project",
                options=project_names_list,
                index=0,  # Default to placeholder
                key="pm_assign_project"
            )
            
            # Get project ID (None if placeholder selected)
            selected_project_id = project_options.get(selected_project_name) if selected_project_name != "-- Select a Project --" else None
        
        with col_managers:
            if selected_project_id:
                # Check if project selection changed - if so, we need to update the multiselect
                project_changed = st.session_state.prev_pm_assign_project != selected_project_id
                
                # Get current owners for this project
                current_owner_ids = owners_ids_map.get(selected_project_id, [])
                current_owner_names = [manager_id_to_name.get(oid, "") for oid in current_owner_ids if oid in manager_id_to_name]
                
                # Use a dynamic key that changes when project changes to force multiselect to reset
                multiselect_key = f"pm_assign_managers_{selected_project_id}"
                
                selected_managers = st.multiselect(
                    "Select PM / APM",
                    options=manager_options,
                    default=current_owner_names,
                    key=multiselect_key,
                    help="Select one or more managers to assign as project owners"
                )
                
                # Update the previous project tracker
                st.session_state.prev_pm_assign_project = selected_project_id
            else:
                st.info("👈 Please select a project first")
                selected_managers = []
        
        col_btn, col_spacer = st.columns([1, 3])
        with col_btn:
            # Only show save button if a project is selected
            if selected_project_id:
                if st.button("💾 Save PM/APM Assignment", type="primary", use_container_width=True):
                    # Convert selected names to user IDs
                    selected_user_ids = [manager_name_to_id[name] for name in selected_managers if name in manager_name_to_id]
                    
                    # Call bulk update API
                    response = authenticated_request(
                        "PUT",
                        f"/admin/projects/{selected_project_id}/owners/bulk",
                        data={"user_ids": selected_user_ids, "work_role": "PM"}
                    )
                    
                    if response:
                        st.success(f"✅ PM/APM updated for {selected_project_name}! Added: {response.get('added', 0)}, Removed: {response.get('removed', 0)}")
                        st.toast("PM/APM assignment saved")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error("❌ Failed to update PM/APM assignment")

        st.markdown("---")

        if st.button("💾 Save Project Changes", type="primary"):
            changes = st.session_state["project_editor"].get("edited_rows", {})

            for row_idx, updates in changes.items():
                original_row = edit_df.iloc[row_idx]
                proj_id = original_row["id"]

                end_val = updates.get("end_date", original_row["end_date"])
                status_val = updates.get("status", original_row["status"])

                if status_val == "COMPLETED" and not end_val:
                    end_val = today_ist()
                if status_val in ["ACTIVE", "PAUSED"]:
                    end_val = None

                safe_active = status_val == "ACTIVE"

                payload = {
                    "name": updates.get("name", original_row["name"]).strip(),
                    "code": updates.get("code", original_row["code"]).strip(),
                    "is_active": safe_active,
                    "start_date": str(updates.get("start_date", original_row["start_date"])),
                    "end_date": str(end_val) if end_val else None
                }

                authenticated_request("PUT", f"/admin/projects/{proj_id}", data=payload)

            st.toast("Projects updated")
            time.sleep(1)
            st.rerun()

    else:
        st.info("No projects found.")

# ==========================================
# TAB 2
# ==========================================
with tab2:
    projects_list = authenticated_request("GET", "/admin/projects/") or []
    proj_map_simple = {p['name']: p['id'] for p in projects_list}

    selected_proj_name = st.selectbox("Select Project", options=list(proj_map_simple.keys()))

    if selected_proj_name:
        selected_proj_id = proj_map_simple[selected_proj_name]
        
        # Add Member Section
        with st.expander("➕ Add Member to Project", expanded=False):
            with st.form("add_member_form"):
                # Get all users with limit parameter
                all_users = authenticated_request("GET", "/admin/users/", params={"limit": 1000}) or []
                # Filter active users only
                active_users = [u for u in all_users if u.get("is_active", True)]
                
                if not active_users:
                    st.warning("No active users found. Please create users first.")
                else:
                    # Get existing member IDs to exclude them from selection
                    existing_members = authenticated_request("GET", f"/admin/projects/{selected_proj_id}/members") or []
                    existing_user_ids = {str(m.get("user_id")) for m in existing_members if m.get("is_active", True)}
                    
                    # Filter out already assigned active users
                    available_users = [u for u in active_users if str(u.get("id")) not in existing_user_ids]
                    
                    if not available_users:
                        st.info("All active users are already assigned to this project.")
                    else:
                        # Create user selection options (name - email format)
                        user_options = {f"{u['name']} ({u['email']})": u['id'] for u in available_users}
                        
                        col1, col2 = st.columns(2)
                        with col1:
                            selected_user_display = st.selectbox(
                                "Select User",
                                options=list(user_options.keys()),
                                key="add_member_user"
                            )
                            selected_user_id = user_options[selected_user_display]
                        
                        with col2:
                            selected_work_role = st.selectbox(
                                "Work Role",
                                options=ROLE_OPTIONS,
                                key="add_member_role"
                            )
                        
                        col3, col4 = st.columns(2)
                        with col3:
                            assigned_from = st.date_input(
                                "Assigned From",
                                value=today_ist(),
                                key="add_member_from"
                            )
                        with col4:
                            assigned_to = st.date_input(
                                "Assigned To (Optional)",
                                value=None,
                                key="add_member_to"
                            )
                        
                        if st.form_submit_button("➕ Add Member", type="primary"):
                            payload = {
                                "user_id": str(selected_user_id),
                                "work_role": selected_work_role,
                                "assigned_from": str(assigned_from),
                                "assigned_to": str(assigned_to) if assigned_to else None
                            }
                            
                            response = authenticated_request("POST", f"/admin/projects/{selected_proj_id}/members", data=payload)
                            
                            if response:
                                # Clear team stats cache so new assignment is reflected immediately
                                clear_team_stats_cache()
                                st.success(f"✅ Member added successfully!")
                                st.toast("Member added")
                                time.sleep(1)
                                st.rerun()
                            else:
                                st.error("❌ Failed to add member. Check if user is already assigned to this project.")
        
        st.markdown("---")
        
        # Display existing members
        st.subheader("👥 Current Team Members")
        members_data = authenticated_request("GET", f"/admin/projects/{selected_proj_id}/members") or []

        if members_data:
            # Create a dataframe for better display
            members_df_data = []
            for m in members_data:
                members_df_data.append({
                    "Name": m.get("name", "-"),
                    "Email": m.get("email", "-"),
                    "Work Role": m.get("work_role", "-"),
                    "Assigned From": m.get("assigned_from", "-"),
                    "Assigned To": m.get("assigned_to", "-") if m.get("assigned_to") else "Ongoing",
                    "Status": "Active" if m.get("is_active", True) else "Inactive",
                    "User ID": m.get("user_id")
                })
            
            df_members = pd.DataFrame(members_df_data)
            
            # Display as dataframe with remove buttons
            st.markdown("### 📋 Members Table")
            display_df = df_members[["Name", "Email", "Work Role", "Assigned From", "Assigned To", "Status"]].copy()
            st.dataframe(display_df, use_container_width=True)
            
            # Edit member role section
            st.markdown("### ✏️ Edit Member Role")
            edit_col1, edit_col2, edit_col3 = st.columns([2, 2, 1])
            with edit_col1:
                edit_user_display = st.selectbox(
                    "Select member to edit",
                    options=[f"{row['Name']} ({row['Email']})" for _, row in df_members.iterrows()],
                    key="edit_member_select"
                )
            with edit_col2:
                # Get current role for selected member
                selected_edit_name = edit_user_display.split(" (")[0] if edit_user_display else None
                current_role = None
                if selected_edit_name:
                    selected_edit_row = df_members[df_members["Name"] == selected_edit_name]
                    if not selected_edit_row.empty:
                        current_role = selected_edit_row.iloc[0]["Work Role"]
                
                # Set default index for selectbox
                default_index = 0
                if current_role and current_role in ROLE_OPTIONS:
                    default_index = ROLE_OPTIONS.index(current_role)
                
                new_role = st.selectbox(
                    "New Work Role",
                    options=ROLE_OPTIONS,
                    index=default_index,
                    key="edit_member_role"
                )
            with edit_col3:
                st.write("")  # Spacing
                st.write("")  # Spacing
                if st.button("💾 Update Role", type="primary", key="edit_member_btn", use_container_width=True):
                    if selected_edit_name:
                        try:
                            selected_edit_row = df_members[df_members["Name"] == selected_edit_name].iloc[0]
                            user_id_to_edit = selected_edit_row["User ID"]
                            
                            # Check if role actually changed
                            if current_role == new_role:
                                st.info(f"ℹ️ {selected_edit_row['Name']} already has role '{new_role}'. No changes made.")
                            else:
                                payload = {
                                    "work_role": new_role
                                }
                                
                                response = authenticated_request("PUT", f"/admin/projects/{selected_proj_id}/members/{user_id_to_edit}", data=payload)
                                if response is not None:
                                    # Clear team stats cache so updated role is reflected immediately
                                    clear_team_stats_cache()
                                    st.success(f"✅ {selected_edit_row['Name']}'s role updated from '{current_role}' to '{new_role}'")
                                    st.toast("Role updated")
                                    time.sleep(1)
                                    st.rerun()
                                else:
                                    st.error("❌ Failed to update role. Please try again.")
                        except Exception as e:
                            st.error(f"❌ Error updating role: {str(e)}")
            
            # Remove member section
            st.markdown("### 🗑️ Remove Member")
            remove_col1, remove_col2 = st.columns([3, 1])
            with remove_col1:
                remove_user_display = st.selectbox(
                    "Select member to remove",
                    options=[f"{row['Name']} ({row['Email']})" for _, row in df_members.iterrows()],
                    key="remove_member_select"
                )
            with remove_col2:
                st.write("")  # Spacing
                st.write("")  # Spacing
                if st.button("🗑️ Remove", type="primary", key="remove_member_btn"):
                    # Find the selected user ID
                    selected_name = remove_user_display.split(" (")[0]
                    selected_row = df_members[df_members["Name"] == selected_name].iloc[0]
                    user_id_to_remove = selected_row["User ID"]
                    
                    response = authenticated_request("DELETE", f"/admin/projects/{selected_proj_id}/members/{user_id_to_remove}")
                    if response is not None:
                        # Clear team stats cache so removal is reflected immediately
                        clear_team_stats_cache()
                        st.success(f"✅ {selected_row['Name']} removed from project")
                        st.toast("Member removed")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error("❌ Failed to remove member")
            
        else:
            st.info("No members assigned to this project yet. Use the 'Add Member' form above to assign team members.")
        
        # Weekoff Update Section
        st.markdown("---")
        st.subheader("📅 Update Weekoff for Users")
        st.caption("Select a user and their weekoff days to update")
        
        # Get all users for the dropdown
        all_users_list = authenticated_request("GET", "/admin/users/", params={"limit": 1000}) or []
        
        if all_users_list:
            # Create user options for dropdown (name - email format)
            user_options = {}
            for user in all_users_list:
                if isinstance(user, dict):
                    user_id = str(user.get("id", "")).strip()
                    user_name = user.get("name", "Unknown")
                    user_email = user.get("email", "")
                    if user_id and user_id != "None":
                        display_name = f"{user_name} ({user_email})" if user_email else user_name
                        user_options[display_name] = {
                            "id": user_id,
                            "name": user_name,
                            "email": user_email,
                            "current_weekoffs": user.get("weekoffs", [])
                        }
            
            if user_options:
                col_user, col_weekoff = st.columns([1, 1])
                
                with col_user:
                    selected_user_display = st.selectbox(
                        "Select User",
                        options=list(user_options.keys()),
                        key="weekoff_user_select"
                    )
                
                if selected_user_display:
                    selected_user = user_options[selected_user_display]
                    current_weekoffs = selected_user.get("current_weekoffs", [])
                    
                    # Convert current weekoffs to list of strings
                    current_weekoff_strings = []
                    if current_weekoffs:
                        for w in current_weekoffs:
                            if isinstance(w, str):
                                current_weekoff_strings.append(w.upper().strip())
                            elif isinstance(w, dict):
                                weekoff_val = (w.get("value") or w.get("name") or "").upper().strip()
                                if weekoff_val:
                                    current_weekoff_strings.append(weekoff_val)
                            elif hasattr(w, 'value'):
                                current_weekoff_strings.append(str(w.value).upper().strip())
                            elif hasattr(w, '__str__'):
                                current_weekoff_strings.append(str(w).upper().strip())
                    
                    # Weekoff day options
                    weekoff_days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
                    
                    with col_weekoff:
                        selected_weekoffs = st.multiselect(
                            "Select Weekoff Days",
                            options=weekoff_days,
                            default=current_weekoff_strings,
                            key="weekoff_days_select"
                        )
                    
                    # Show current weekoffs
                    if current_weekoff_strings:
                        st.info(f"📌 Current weekoffs: {', '.join(current_weekoff_strings)}")
                    
                    # Update button
                    col_btn1, col_btn2 = st.columns([1, 4])
                    with col_btn1:
                        if st.button("🔄 Update Weekoff", type="primary", use_container_width=True, key="update_weekoff_btn"):
                            if selected_weekoffs:
                                # Prepare update payload
                                update_payload = {
                                    "weekoffs": selected_weekoffs
                                }
                                
                                # Make API call to update user
                                user_id = selected_user["id"]
                                response = authenticated_request(
                                    "PUT",
                                    f"/admin/users/{user_id}",
                                    data=update_payload
                                )
                                
                                if response:
                                    st.success(f"✅ Successfully updated weekoff for {selected_user['name']}!")
                                    st.toast("Weekoff updated")
                                    time.sleep(1)
                                    st.rerun()
                                else:
                                    st.error("❌ Failed to update weekoff. Please check the error message above.")
                            else:
                                st.warning("⚠️ Please select at least one weekoff day.")
        else:
            st.info("No users available to update weekoff.")

# ==========================================
# TAB 3: QUALITY ASSESSMENT
# ==========================================
with tab3:
    # Helper functions for quality assessment
    @st.cache_data(ttl=300)
    def get_user_name_mapping_qa() -> dict:
        """Fetch all users and create UUID -> name mapping"""
        users = authenticated_request("GET", "/admin/users/", params={"limit": 1000}) or []
        if not users:
            return {}
        return {str(user["id"]): user["name"] for user in users}
    
    @st.cache_data(ttl=300)
    def get_user_email_mapping_qa() -> dict:
        """Fetch all users and create UUID -> email mapping"""
        users = authenticated_request("GET", "/admin/users/", params={"limit": 1000}) or []
        if not users:
            return {}
        return {str(user["id"]): user.get("email", "") for user in users}
    
    @st.cache_data(ttl=300)
    def get_project_name_mapping_qa() -> dict:
        """Fetch all projects and create UUID -> name mapping"""
        projects = authenticated_request("GET", "/admin/projects/") or []
        if not projects:
            return {}
        return {str(project["id"]): project["name"] for project in projects}
    
    st.markdown("### ⭐ Quality Assessment")
    st.markdown("Manually assess quality ratings for users on specific dates")
    st.markdown("---")
    
    # Mode selector
    mode = st.radio(
        "Assessment Mode",
        ["Individual Assessment", "Bulk Upload"],
        horizontal=True,
        key="quality_mode_pmc"
    )
    
    st.markdown("---")
    
    if mode == "Individual Assessment":
        st.markdown("#### 📝 Individual Quality Assessment")
        
        # Get mappings
        user_map = get_user_name_mapping_qa()
        user_email_map = get_user_email_mapping_qa()
        project_map = get_project_name_mapping_qa()
        
        if not user_map or not project_map:
            st.error("⚠️ Unable to load users or projects. Please check your connection.")
        else:
            # Create user options with email display: "Name (email)"
            user_options_display = {}
            for user_id, user_name in user_map.items():
                email = user_email_map.get(user_id, "")
                if email:
                    display_name = f"{user_name} ({email})"
                else:
                    display_name = user_name
                user_options_display[display_name] = user_id
            
            # Create reverse mapping for project
            project_id_to_name = {v: k for k, v in project_map.items()}
            
            # Form fields
            col1, col2, col3 = st.columns(3)
            
            with col1:
                # User selection with email
                user_display_list = sorted(user_options_display.keys())
                selected_user_display = st.selectbox("Select User", user_display_list, key="qa_user_pmc")
                selected_user_id = user_options_display.get(selected_user_display)
            
            with col2:
                # Project selection
                project_options = sorted(project_map.values())
                selected_project_name = st.selectbox("Select Project", project_options, key="qa_project_pmc")
                selected_project_id = project_id_to_name.get(selected_project_name)
            
            with col3:
                # Date selection
                selected_date = st.date_input("Assessment Date", value=today_ist(), key="qa_date_pmc")
            
            # Quality rating
            col4, col5 = st.columns(2)
            
            with col4:
                rating = st.selectbox(
                    "Quality Rating",
                    ["GOOD", "AVERAGE", "BAD"],
                    help="GOOD: High quality work\nAVERAGE: Acceptable quality\nBAD: Poor quality requiring improvement",
                    key="qa_rating_pmc"
                )
            
            with col5:
                quality_score = st.number_input(
                    "Quality Score (0-10)",
                    min_value=0.0,
                    max_value=10.0,
                    value=7.0,
                    step=0.1,
                    help="Numeric score from 0 (poor) to 10 (excellent). Optional but recommended.",
                    key="qa_score_pmc"
                )
            
            # Accuracy and Critical Rate
            col6, col7 = st.columns(2)
            
            with col6:
                accuracy = st.number_input(
                    "Accuracy (%)",
                    min_value=0.0,
                    max_value=100.0,
                    value=None,
                    step=0.1,
                    help="Percentage of work completed correctly (0-100%). Optional.",
                    key="qa_accuracy_pmc"
                )
            
            with col7:
                critical_rate = st.number_input(
                    "Critical Rate (%)",
                    min_value=0.0,
                    max_value=100.0,
                    value=None,
                    step=0.1,
                    help="Percentage of critical tasks handled successfully (0-100%). Optional.",
                    key="qa_critical_rate_pmc"
                )
            
            # Notes
            notes = st.text_area(
                "Assessment Notes (Optional)",
                placeholder="Add any additional comments about the quality assessment...",
                height=100,
                key="qa_notes_pmc"
            )
            
            # Submit button
            if st.button("💾 Save Quality Assessment", type="primary", use_container_width=True, key="qa_save_pmc"):
                if not selected_user_id or not selected_project_id:
                    st.error("Please select both user and project.")
                else:
                    with st.spinner("Submitting quality assessment..."):
                        payload = {
                            "user_id": selected_user_id,
                            "project_id": selected_project_id,
                            "metric_date": str(selected_date),
                            "rating": rating,
                            "quality_score": float(quality_score) if quality_score else None,
                            "accuracy": float(accuracy) if accuracy is not None else None,
                            "critical_rate": float(critical_rate) if critical_rate is not None else None,
                            "notes": notes if notes.strip() else None
                        }
                        
                        result = authenticated_request("POST", "/admin/metrics/user_daily/quality", data=payload)
                        
                        if result:
                            st.success(f"✅ Quality assessment saved successfully!")
                            st.balloons()
                            # Clear cache to refresh data
                            get_user_name_mapping_qa.clear()
                            get_user_email_mapping_qa.clear()
                            get_project_name_mapping_qa.clear()
                            # Force rerun to refresh the table
                            time.sleep(0.5)
                            st.rerun()
            
            # Existing assessments view
            st.markdown("---")
            st.markdown("#### 📋 Recent Quality Assessments")
            
            # Fetch existing assessments
            if selected_user_id and selected_project_id:
                params = {
                    "user_id": selected_user_id,
                    "project_id": selected_project_id,
                    "start_date": str(selected_date - timedelta(days=30)),
                    "end_date": str(selected_date + timedelta(days=1))
                }
                
                quality_data = authenticated_request("GET", "/admin/metrics/user_daily/quality-ratings", params=params) or []
                
                if quality_data:
                    df_quality = pd.DataFrame(quality_data)
                    df_quality["metric_date"] = pd.to_datetime(df_quality["metric_date"]).dt.date
                    
                    # Format for display
                    df_quality["quality_rating"] = df_quality["quality_rating"].apply(
                        lambda x: {"GOOD": "✅ Good", "AVERAGE": "⚠️ Average", "BAD": "❌ Bad"}.get(x, x) if x else "Not Assessed"
                    )
                    
                    if "quality_score" in df_quality.columns:
                        df_quality["quality_score"] = df_quality["quality_score"].apply(
                            lambda x: f"{x:.1f}" if x is not None else "N/A"
                        )
                    
                    if "accuracy" in df_quality.columns:
                        df_quality["accuracy"] = df_quality["accuracy"].apply(
                            lambda x: f"{x:.1f}%" if x is not None else "N/A"
                        )
                    
                    if "critical_rate" in df_quality.columns:
                        df_quality["critical_rate"] = df_quality["critical_rate"].apply(
                            lambda x: f"{x:.1f}%" if x is not None else "N/A"
                        )
                    
                    display_cols = ["metric_date", "quality_rating", "quality_score", "accuracy", "critical_rate", "source", "notes"]
                    display_cols = [col for col in display_cols if col in df_quality.columns]
                    
                    st.dataframe(
                        df_quality[display_cols].sort_values("metric_date", ascending=False),
                        use_container_width=True,
                        height=300
                    )
                else:
                    st.info("No quality assessments found for this user/project combination in the last 30 days.")
    
    else:
        # Bulk Upload
        st.markdown("#### 📤 Bulk Quality Assessment Upload")
        
        st.markdown("""
        **CSV Format Required:**
        - `user_email`: User's email address
        - `project_code`: Project code
        - `metric_date`: Date in YYYY-MM-DD format
        - `rating`: Quality rating (GOOD, AVERAGE, or BAD)
        - `quality_score` (optional): Numeric score 0-10
        - `accuracy` (optional): Accuracy percentage 0-100
        - `critical_rate` (optional): Critical rate percentage 0-100
        - `work_role` (optional): Work role (will be fetched from project_members if not provided)
        - `notes` (optional): Assessment notes
        
        **Example CSV:**
        ```csv
        user_email,project_code,metric_date,rating,quality_score,accuracy,critical_rate,notes
        user@example.com,PROJ001,2024-01-15,GOOD,8.5,95.0,88.5,Excellent work quality
        user2@example.com,PROJ002,2024-01-15,AVERAGE,6.0,75.0,70.0,Acceptable quality
        ```
        """)
        
        uploaded_file = st.file_uploader(
            "Upload CSV File",
            type=["csv"],
            help="Upload a CSV file with quality assessments",
            key="qa_upload_pmc"
        )
        
        if uploaded_file:
            # Preview CSV
            try:
                df_preview = pd.read_csv(uploaded_file)
                st.markdown("##### 📄 CSV Preview")
                st.dataframe(df_preview.head(10), use_container_width=True)
                
                if st.button("📤 Upload Quality Assessments", type="primary", use_container_width=True, key="qa_upload_btn_pmc"):
                    # Reset file pointer
                    uploaded_file.seek(0)
                    
                    with st.spinner("Uploading quality assessments..."):
                        response = authenticated_request("POST", "/admin/bulk_uploads/quality", uploaded_file=uploaded_file)
                        
                        if response:
                            st.success(f"✅ Successfully uploaded {response.get('inserted', 0)} quality assessments!")
                            
                            if response.get("errors"):
                                st.warning(f"⚠️ {len(response['errors'])} errors encountered:")
                                with st.expander("View Errors"):
                                    for error in response["errors"]:
                                        st.text(error)
                            
                            st.balloons()
                            get_user_name_mapping_qa.clear()
                            get_user_email_mapping_qa.clear()
                            get_project_name_mapping_qa.clear()
                            time.sleep(0.5)
                            st.rerun()
                        else:
                            st.error("❌ Upload failed. Please check the file format and try again.")
            
            except Exception as e:
                st.error(f"❌ Error reading CSV file: {str(e)}")
        
        # Download template
        st.markdown("---")
        st.markdown("#### 📥 Download CSV Template")
        
        template_data = {
            "user_email": ["user@example.com"],
            "project_code": ["PROJ001"],
            "metric_date": ["2024-01-15"],
            "rating": ["GOOD"],
            "quality_score": [8.5],
            "accuracy": [95.0],
            "critical_rate": [88.5],
            "work_role": [""],
            "notes": ["Example quality assessment"]
        }
        template_df = pd.DataFrame(template_data)
        csv_template = template_df.to_csv(index=False).encode('utf-8')
        
        st.download_button(
            label="📥 Download CSV Template",
            data=csv_template,
            file_name="quality_assessment_template.csv",
            mime="text/csv",
            key="qa_template_pmc"
        )

# ==========================================
# TAB 4: USER MANAGEMENT
# ==========================================
with tab4:
    st.subheader("User Management")
    
    # Fetch required data for dropdowns
    @st.cache_data(ttl=300)
    def fetch_shifts():
        token = st.session_state.get("token")
        if not token:
            return []
        headers = {"Authorization": f"Bearer {token}"}
        try:
            res = requests.get(f"{API_BASE_URL}/admin/shifts/", headers=headers)
            if res.status_code == 200:
                return res.json()
        except:
            pass
        return []
    
    @st.cache_data(ttl=300)
    def fetch_managers_for_rpm():
        token = st.session_state.get("token")
        if not token:
            return []
        headers = {"Authorization": f"Bearer {token}"}
        try:
            res = requests.get(f"{API_BASE_URL}/admin/users/project_managers", headers=headers)
            if res.status_code == 200:
                return res.json()
        except:
            pass
        return []
    
    shifts_data = fetch_shifts()
    managers_data = fetch_managers_for_rpm()
    
    # Create lookup maps
    shift_map = {s["name"]: s["id"] for s in shifts_data}
    shift_id_to_name = {s["id"]: s["name"] for s in shifts_data}
    manager_map = {f"{m['name']} ({m['email']})": m["id"] for m in managers_data}
    manager_id_to_display = {m["id"]: f"{m['name']} ({m['email']})" for m in managers_data}
    
    WEEKOFF_OPTIONS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    ROLE_OPTIONS_USER = ["USER", "MANAGER", "ADMIN"]
    
    # Two sections: Add User and Manage Users
    user_section = st.radio("Select Action", ["➕ Add New User", "🔍 Search & Edit Users"], horizontal=True, key="user_mgmt_action")
    
    st.markdown("---")
    
    # ==========================================
    # ADD NEW USER SECTION
    # ==========================================
    if user_section == "➕ Add New User":
        st.markdown("### Add New User")
        
        # Sub-tabs for single user vs bulk upload
        add_method = st.radio("Add Method", ["Single User", "Bulk Upload (CSV)"], horizontal=True, key="add_user_method")
        
        if add_method == "Single User":
            with st.form("add_user_form", clear_on_submit=True):
                col1, col2 = st.columns(2)
                
                with col1:
                    new_user_email = st.text_input("Email *", placeholder="user@example.com")
                    new_user_name = st.text_input("Name *", placeholder="John Doe")
                    new_user_role = st.selectbox("Role *", ROLE_OPTIONS_USER, index=0)
                    new_user_doj = st.date_input("Date of Joining", value=today_ist())
                    new_user_shift = st.selectbox("Default Shift", ["-- Select Shift --"] + list(shift_map.keys()))
                
                with col2:
                    new_user_rpm = st.selectbox("Reporting Manager (RPM)", ["-- Select Manager --"] + list(manager_map.keys()))
                    new_user_weekoffs = st.multiselect("Weekoffs", WEEKOFF_OPTIONS, default=["SUNDAY"])
                    new_user_work_role = st.text_input("Work Role", placeholder="e.g., CONTRACTOR, EMPLOYEE")
                    new_user_soul_id = st.text_input("Soul ID", placeholder="Optional - UUID format")
                    new_user_quality_rating = st.text_input("Quality Rating", placeholder="Optional")
                
                # Password field (not needed for Google OAuth)
                st.text_input("Password", placeholder="Not needed (Google OAuth)", disabled=True)
                
                submitted = st.form_submit_button("➕ Add User", type="primary", use_container_width=True)
                
                if submitted:
                    # Validation
                    if not new_user_email or not new_user_name:
                        st.error("Email and Name are required fields.")
                    else:
                        # Build payload
                        payload = {
                            "email": new_user_email.strip(),
                            "name": new_user_name.strip(),
                            "role": new_user_role,
                            "doj": str(new_user_doj),
                            "is_active": True,
                            "weekoffs": new_user_weekoffs if new_user_weekoffs else ["SUNDAY"],
                        }
                        
                        # Optional fields
                        if new_user_shift and new_user_shift != "-- Select Shift --":
                            payload["default_shift_id"] = shift_map[new_user_shift]
                        
                        if new_user_rpm and new_user_rpm != "-- Select Manager --":
                            payload["rpm_user_id"] = manager_map[new_user_rpm]
                        
                        if new_user_work_role:
                            payload["work_role"] = new_user_work_role.strip()
                        
                        if new_user_soul_id:
                            payload["soul_id"] = new_user_soul_id.strip()
                        
                        if new_user_quality_rating:
                            payload["quality_rating"] = new_user_quality_rating.strip()
                        
                        # Make API call
                        result = authenticated_request("POST", "/admin/users/", data=payload)
                        
                        if result:
                            st.success(f"✅ User '{new_user_name}' added successfully!")
                            st.cache_data.clear()
                            time.sleep(1)
                            st.rerun()
        
        else:
            # Bulk Upload Section
            st.markdown("#### 📤 Bulk Upload Users via CSV")
            
            st.info("""
            **CSV Format Requirements:**
            - **Required columns:** `email`, `name`, `role`
            - **Optional columns:** `doj`, `work_role`, `weekoffs`, `shift_name`, `rpm_email`, `soul_id`, `quality_rating`
            - **Role values:** USER, MANAGER, ADMIN
            - **Weekoffs:** Comma-separated days (e.g., "SUNDAY,SATURDAY")
            - **Date format:** YYYY-MM-DD
            """)
            
            # Download template
            st.markdown("##### 📥 Download CSV Template")
            template_data = {
                "email": ["user1@example.com", "user2@example.com"],
                "name": ["John Doe", "Jane Smith"],
                "role": ["USER", "USER"],
                "doj": [str(today_ist()), str(today_ist())],
                "work_role": ["EMPLOYEE", "CONTRACTOR"],
                "weekoffs": ["SUNDAY", "SUNDAY,SATURDAY"],
                "shift_name": ["", ""],
                "rpm_email": ["", ""],
                "soul_id": ["", ""],
                "quality_rating": ["", ""]
            }
            template_df = pd.DataFrame(template_data)
            csv_template = template_df.to_csv(index=False).encode('utf-8')
            
            st.download_button(
                label="📥 Download CSV Template",
                data=csv_template,
                file_name="users_bulk_upload_template.csv",
                mime="text/csv",
                key="users_bulk_template"
            )
            
            st.markdown("---")
            st.markdown("##### 📤 Upload CSV File")
            
            uploaded_file = st.file_uploader("Choose a CSV file", type=["csv"], key="users_bulk_upload")
            
            if uploaded_file is not None:
                try:
                    df = pd.read_csv(uploaded_file)
                    
                    # Validate required columns
                    required_cols = ["email", "name", "role"]
                    missing_cols = [col for col in required_cols if col not in df.columns]
                    
                    if missing_cols:
                        st.error(f"❌ Missing required columns: {', '.join(missing_cols)}")
                    else:
                        st.markdown("##### Preview of Users to be Added")
                        st.dataframe(df, use_container_width=True)
                        
                        st.markdown(f"**Total users to add: {len(df)}**")
                        
                        # Create reverse lookup maps
                        shift_name_to_id = {s["name"]: s["id"] for s in shifts_data}
                        manager_email_to_id = {m["email"]: m["id"] for m in managers_data}
                        
                        if st.button("📤 Upload Users", type="primary", key="btn_bulk_upload_users"):
                            success_count = 0
                            error_count = 0
                            errors = []
                            
                            progress_bar = st.progress(0)
                            status_text = st.empty()
                            
                            for idx, row in df.iterrows():
                                progress = (idx + 1) / len(df)
                                progress_bar.progress(progress)
                                status_text.text(f"Processing {idx + 1}/{len(df)}: {row['email']}")
                                
                                try:
                                    # Build payload
                                    payload = {
                                        "email": str(row["email"]).strip(),
                                        "name": str(row["name"]).strip(),
                                        "role": str(row["role"]).strip().upper(),
                                        "is_active": True,
                                    }
                                    
                                    # Handle DOJ
                                    if "doj" in row and pd.notna(row["doj"]) and str(row["doj"]).strip():
                                        payload["doj"] = str(row["doj"]).strip()
                                    else:
                                        payload["doj"] = str(today_ist())
                                    
                                    # Handle weekoffs
                                    if "weekoffs" in row and pd.notna(row["weekoffs"]) and str(row["weekoffs"]).strip():
                                        weekoffs_str = str(row["weekoffs"]).strip()
                                        weekoffs_list = [w.strip().upper() for w in weekoffs_str.split(",")]
                                        payload["weekoffs"] = weekoffs_list
                                    else:
                                        payload["weekoffs"] = ["SUNDAY"]
                                    
                                    # Handle work_role
                                    if "work_role" in row and pd.notna(row["work_role"]) and str(row["work_role"]).strip():
                                        payload["work_role"] = str(row["work_role"]).strip()
                                    
                                    # Handle shift_name -> default_shift_id
                                    if "shift_name" in row and pd.notna(row["shift_name"]) and str(row["shift_name"]).strip():
                                        shift_name = str(row["shift_name"]).strip()
                                        if shift_name in shift_name_to_id:
                                            payload["default_shift_id"] = shift_name_to_id[shift_name]
                                    
                                    # Handle rpm_email -> rpm_user_id
                                    if "rpm_email" in row and pd.notna(row["rpm_email"]) and str(row["rpm_email"]).strip():
                                        rpm_email = str(row["rpm_email"]).strip()
                                        if rpm_email in manager_email_to_id:
                                            payload["rpm_user_id"] = manager_email_to_id[rpm_email]
                                    
                                    # Handle soul_id
                                    if "soul_id" in row and pd.notna(row["soul_id"]) and str(row["soul_id"]).strip():
                                        payload["soul_id"] = str(row["soul_id"]).strip()
                                    
                                    # Handle quality_rating
                                    if "quality_rating" in row and pd.notna(row["quality_rating"]) and str(row["quality_rating"]).strip():
                                        payload["quality_rating"] = str(row["quality_rating"]).strip()
                                    
                                    # Make API call
                                    result = authenticated_request("POST", "/admin/users/", data=payload)
                                    
                                    if result:
                                        success_count += 1
                                    else:
                                        error_count += 1
                                        errors.append(f"Row {idx + 1} ({row['email']}): API error")
                                
                                except Exception as e:
                                    error_count += 1
                                    errors.append(f"Row {idx + 1} ({row.get('email', 'unknown')}): {str(e)}")
                            
                            progress_bar.progress(1.0)
                            status_text.text("Upload complete!")
                            
                            # Show results
                            st.markdown("---")
                            st.markdown("##### Upload Results")
                            
                            col1, col2 = st.columns(2)
                            with col1:
                                st.success(f"✅ Successfully added: {success_count} users")
                            with col2:
                                if error_count > 0:
                                    st.error(f"❌ Failed: {error_count} users")
                            
                            if errors:
                                with st.expander("View Errors"):
                                    for err in errors:
                                        st.warning(err)
                            
                            if success_count > 0:
                                st.cache_data.clear()
                                st.info("Page will refresh in 2 seconds...")
                                time.sleep(2)
                                st.rerun()
                
                except Exception as e:
                    st.error(f"❌ Error reading CSV file: {str(e)}")
    
    # ==========================================
    # SEARCH & EDIT USERS SECTION
    # ==========================================
    else:
        st.markdown("### Search & Edit Users")
        
        # Search filters
        col1, col2, col3 = st.columns(3)
        with col1:
            search_name = st.text_input("Search by Name", placeholder="Enter name...", key="user_search_name")
        with col2:
            search_email = st.text_input("Search by Email", placeholder="Enter email...", key="user_search_email")
        with col3:
            search_active = st.selectbox("Active Status", ["All", "Active Only", "Inactive Only"], key="user_search_active")
        
        # Fetch users based on search
        @st.cache_data(ttl=60)
        def search_users(name_filter, email_filter, active_filter):
            token = st.session_state.get("token")
            if not token:
                return []
            headers = {"Authorization": f"Bearer {token}"}
            
            params = {"limit": 100, "offset": 0}
            if name_filter:
                params["name"] = name_filter
            if email_filter:
                params["email"] = email_filter
            if active_filter == "Active Only":
                params["is_active"] = True
            elif active_filter == "Inactive Only":
                params["is_active"] = False
            
            try:
                res = requests.get(f"{API_BASE_URL}/admin/users/", headers=headers, params=params)
                if res.status_code == 200:
                    return res.json()
            except:
                pass
            return []
        
        if st.button("🔍 Search Users", key="btn_search_users"):
            st.session_state.user_search_triggered = True
        
        if st.session_state.get("user_search_triggered", False):
            users_list = search_users(search_name, search_email, search_active)
            
            if not users_list:
                st.info("No users found matching the search criteria.")
            else:
                st.markdown(f"**Found {len(users_list)} user(s)**")
                
                # Display users in a selectable format
                user_display_options = [f"{u['name']} ({u['email']}) - {'Active' if u['is_active'] else 'Inactive'}" for u in users_list]
                user_id_map = {f"{u['name']} ({u['email']}) - {'Active' if u['is_active'] else 'Inactive'}": u for u in users_list}
                
                selected_user_display = st.selectbox(
                    "Select a user to edit",
                    ["-- Select User --"] + user_display_options,
                    key="edit_user_select"
                )
                
                if selected_user_display and selected_user_display != "-- Select User --":
                    selected_user = user_id_map[selected_user_display]
                    
                    st.markdown("---")
                    st.markdown(f"### Edit User: {selected_user['name']}")
                    
                    with st.form(f"edit_user_form_{selected_user['id']}", clear_on_submit=False):
                        col1, col2 = st.columns(2)
                        
                        with col1:
                            edit_email = st.text_input("Email *", value=selected_user.get("email", ""))
                            edit_name = st.text_input("Name *", value=selected_user.get("name", ""))
                            
                            # Role
                            current_role = selected_user.get("role", "USER")
                            if hasattr(current_role, 'value'):
                                current_role = current_role.value
                            role_index = ROLE_OPTIONS_USER.index(current_role) if current_role in ROLE_OPTIONS_USER else 0
                            edit_role = st.selectbox("Role *", ROLE_OPTIONS_USER, index=role_index)
                            
                            # DOJ
                            current_doj = selected_user.get("doj")
                            if current_doj:
                                if isinstance(current_doj, str):
                                    current_doj = datetime.strptime(current_doj, "%Y-%m-%d").date()
                            else:
                                current_doj = today_ist()
                            edit_doj = st.date_input("Date of Joining", value=current_doj)
                            
                            # DOL (Date of Leaving)
                            current_dol = selected_user.get("dol")
                            if current_dol:
                                if isinstance(current_dol, str):
                                    current_dol = datetime.strptime(current_dol, "%Y-%m-%d").date()
                                edit_dol = st.date_input("Date of Leaving", value=current_dol)
                            else:
                                # Use a checkbox to enable DOL input when user is being deactivated
                                edit_dol = st.date_input("Date of Leaving (Optional)", value=None)
                            
                            # Shift
                            current_shift_id = selected_user.get("default_shift_id")
                            current_shift_name = shift_id_to_name.get(current_shift_id, None) if current_shift_id else None
                            shift_options = ["-- Select Shift --"] + list(shift_map.keys())
                            shift_index = shift_options.index(current_shift_name) if current_shift_name in shift_options else 0
                            edit_shift = st.selectbox("Default Shift", shift_options, index=shift_index)
                            
                            # Is Active toggle
                            edit_is_active = st.checkbox("Is Active", value=selected_user.get("is_active", True))
                            if not edit_is_active and not current_dol:
                                st.caption("💡 Date of Leaving will be auto-set to today if left empty")
                        
                        with col2:
                            # RPM
                            current_rpm_id = selected_user.get("rpm_user_id")
                            current_rpm_display = manager_id_to_display.get(current_rpm_id, None) if current_rpm_id else None
                            rpm_options = ["-- Select Manager --"] + list(manager_map.keys())
                            rpm_index = rpm_options.index(current_rpm_display) if current_rpm_display in rpm_options else 0
                            edit_rpm = st.selectbox("Reporting Manager (RPM)", rpm_options, index=rpm_index)
                            
                            # Weekoffs
                            current_weekoffs = selected_user.get("weekoffs", ["SUNDAY"])
                            if current_weekoffs:
                                # Handle enum values
                                current_weekoffs = [w.value if hasattr(w, 'value') else w for w in current_weekoffs]
                            else:
                                current_weekoffs = ["SUNDAY"]
                            edit_weekoffs = st.multiselect("Weekoffs", WEEKOFF_OPTIONS, default=current_weekoffs)
                            
                            edit_work_role = st.text_input("Work Role", value=selected_user.get("work_role", "") or "")
                            edit_soul_id = st.text_input("Soul ID", value=str(selected_user.get("soul_id", "")) if selected_user.get("soul_id") else "")
                            edit_quality_rating = st.text_input("Quality Rating", value=selected_user.get("quality_rating", "") or "")
                        
                        col_btn1, col_btn2 = st.columns(2)
                        with col_btn1:
                            update_submitted = st.form_submit_button("💾 Save Changes", type="primary", use_container_width=True)
                        with col_btn2:
                            # Deactivate/Activate button based on current status
                            if edit_is_active:
                                toggle_label = "🚫 Deactivate User"
                            else:
                                toggle_label = "✅ Activate User"
                        
                        if update_submitted:
                            # Build update payload
                            update_payload = {
                                "email": edit_email.strip(),
                                "name": edit_name.strip(),
                                "role": edit_role,
                                "doj": str(edit_doj),
                                "is_active": edit_is_active,
                                "weekoffs": edit_weekoffs if edit_weekoffs else ["SUNDAY"],
                            }
                            
                            # Optional fields
                            if edit_shift and edit_shift != "-- Select Shift --":
                                update_payload["default_shift_id"] = shift_map[edit_shift]
                            else:
                                update_payload["default_shift_id"] = None
                            
                            if edit_rpm and edit_rpm != "-- Select Manager --":
                                update_payload["rpm_user_id"] = manager_map[edit_rpm]
                            else:
                                update_payload["rpm_user_id"] = None
                            
                            update_payload["work_role"] = edit_work_role.strip() if edit_work_role else None
                            update_payload["soul_id"] = edit_soul_id.strip() if edit_soul_id else None
                            update_payload["quality_rating"] = edit_quality_rating.strip() if edit_quality_rating else None
                            
                            # DOL - only include if manually set (backend will auto-manage based on is_active)
                            if edit_dol:
                                update_payload["dol"] = str(edit_dol)
                            
                            # Make API call
                            result = authenticated_request("PUT", f"/admin/users/{selected_user['id']}", data=update_payload)
                            
                            if result:
                                st.success(f"✅ User '{edit_name}' updated successfully!")
                                st.cache_data.clear()
                                time.sleep(1)
                                st.rerun()