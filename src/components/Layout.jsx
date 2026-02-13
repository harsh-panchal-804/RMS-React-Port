"use client";
import React, { useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import {
  IconBrandTabler,
  IconHome,
  IconAlertTriangle,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Settings, LogOut, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import ProjectProductivityDashboard from "./Dashboard";
import UserProductivityDashboard from "./UserDashboard";
import ProjectResourceAllocation from "./ProjectResourceAllocation";
import AttendanceRequestApprovals from "./AttendanceRequestApprovals";
import TimeSheetApprovals from "./TimeSheetApprovals";
import ProjectManagementCenter from "./ProjectManagementCenter";
import ReportsCenter from "./ReportsCenter";
import TeamStats from "./TeamStats";
import UserHistory from "./UserHistory";
import AttendanceDaily from "./AttendanceDaily";
import AttendanceRequests from "./AttendanceRequests";
import UserHome from "./UserHome";
import Home from "./Home";
import NotFound from "./NotFound";
import { Login } from "./Login";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
const deccanLogo="https://media.licdn.com/dms/image/v2/D560BAQEzBjCGyU-wsg/company-logo_200_200/company-logo_200_200/0/1730125488452/ai_deccan_logo?e=2147483647&v=beta&t=cc_gAknLXf7v4aW23hRw17JopzqOEsvGlYm2FOOrQb4"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

export function Layout() {
  const [hoverOpen, setHoverOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, loading, user, token, logout } = useAuth();
  
  // Debug logging
  React.useEffect(() => {
    console.log('🔍 Layout Auth State:', {
      isAuthenticated,
      loading,
      hasUser: !!user,
      hasToken: !!token,
      userEmail: user?.email,
      userRole: user?.role,
    });
  }, [isAuthenticated, loading, user, token]);
  
  // Check if current route should hide sidebar (404 page)
  const validRoutes = [
    "/",
    "/dashboard",
    "/user-dashboard",
    "/project-resource-allocation",
    "/attendance-approvals",
    "/time-sheet-approvals",
    "/project-management",
    "/reports",
    "/team-stats",
    "/history",
    "/attendance-daily",
    "/attendance-requests",
    "/404",
  ];
  const is404Page = !validRoutes.includes(location.pathname) || location.pathname === "/404";

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    console.log('⚠️ Not authenticated, showing login');
    return <Login />;
  }

  console.log('✅ Authenticated, showing layout');

  const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(user?.role);

  const adminLinks = [
    {
      label: "Home",
      path: "/",
      icon: (
        <IconHome className="h-4 w-4  shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Project Productivity Dashboard",
      path: "/dashboard",
      icon: (
        <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    ...(user?.role === 'ADMIN'
      ? [{
          label: "User Productivity Dashboard",
          path: "/user-dashboard",
          icon: (
            <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
          ),
        }]
      : []),
    {
      label: "Project Resource Allocation",
      path: "/project-resource-allocation",
      icon: (
        <IconUsersGroup className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Time Sheet Approvals",
      path: "/time-sheet-approvals",
      icon: (
        <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Attendance Approvals",
      path: "/attendance-approvals",
      icon: (
        <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Admin Projects",
      path: "/project-management",
      icon: (
        <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Reports Center",
      path: "/reports",
      icon: (
        <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "404 Page (Demo)",
      path: "/404",
      icon: (
        <IconAlertTriangle className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
  ];

  const userLinks = [
    {
      label: "Home",
      path: "/",
      icon: <IconHome className="h-4 w-4  shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Team stats",
      path: "/team-stats",
      icon: <IconUsersGroup className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Leave/WFH Requests",
      path: "/attendance-requests",
      icon: <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "History",
      path: "/history",
      icon: <IconBrandTabler className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
  ];

  const links = isAdminOrManager ? adminLinks : userLinks;
  
  // If 404 page, render without sidebar
  if (is404Page) {
    return (
      <div className="h-screen w-screen overflow-hidden fixed inset-0">
        <NotFound />
      </div>
    );
  }
  
  return (
    <SidebarProvider 
      defaultOpen={false} 
      open={hoverOpen} 
      onOpenChange={setHoverOpen}
      style={{ "--sidebar-width": "22rem", "--sidebar-width-icon": "3.5rem" }}
    >
      <div className="flex min-h-screen w-full relative">
        <div
          className="absolute left-0 top-0 h-full w-16 z-20"
          onMouseEnter={() => setHoverOpen(true)}
          onMouseLeave={() => setHoverOpen(false)}
        />
        <Sidebar 
          collapsible="icon" 
          onMouseEnter={() => setHoverOpen(true)}
          onMouseLeave={() => setHoverOpen(false)}
          className="[&_[data-slot=sidebar-gap]]:!duration-500 [&_[data-slot=sidebar-container]]:!duration-500"
        >
          <SidebarHeader className="p-4">
            <SidebarLogo />
          </SidebarHeader>
          <SidebarContent className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              <SidebarMenu className="mt-4 flex flex-col gap-2">
                {links.map((link, idx) => (
                  <SidebarMenuItem key={idx}>
                    <SidebarMenuButton
                      tooltip={link.label}
                      asChild
                      className={cn(
                        "w-full justify-start",
                        location.pathname === link.path && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <NavLink 
                        to={link.path}
                        className="flex items-center gap-2 w-full"
                      >
                        {link.icon}
                        <span className="text-sm">
                          {link.label}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex-1 w-full flex flex-col">
          <div className="flex items-center justify-end p-4 border-b">
            <div className="flex items-center gap-2">
              {user && (
                <Avatar className="h-8 w-8 ring-2 ring-ring ring-offset-2 ring-offset-background">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>
                    {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Open settings</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm">Theme</span>
                      <AnimatedThemeToggler 
                        className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center" 
                      />
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {user && (
                    <>
                      <DropdownMenuItem disabled>
                        <span>Role: {user.role}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={isAdminOrManager ? <Home /> : <UserHome />} />
              <Route path="/dashboard" element={<ProjectProductivityDashboard />} />
              <Route path="/user-dashboard" element={<UserProductivityDashboard />} />
              <Route path="/project-resource-allocation" element={<ProjectResourceAllocation />} />
              <Route path="/time-sheet-approvals" element={<TimeSheetApprovals />} />
              <Route path="/attendance-approvals" element={<AttendanceRequestApprovals />} />
              <Route path="/project-management" element={<ProjectManagementCenter />} />
              <Route path="/reports" element={<ReportsCenter />} />
              <Route path="/team-stats" element={<TeamStats />} />
              <Route path="/history" element={<UserHistory />} />
              <Route path="/attendance-daily" element={<AttendanceDaily />} />
              <Route path="/attendance-requests" element={<AttendanceRequests />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function SidebarLogo() {
  const { state } = useSidebar();
  const open = state === "expanded";
  
  return (
    <NavLink
      to="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal">
      <img
        src={deccanLogo}
        alt="Deccan AI"
        className="h-10 w-10 shrink-0 object-contain rounded-md transition-all duration-300 ease-in-out hover:scale-110 "
        // style={{ filter: 'brightness(0) invert(1)' }}
      />
      {open && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-medium whitespace-pre text-sidebar-foreground">
          Deccan AI
        </motion.span>
      )}
    </NavLink>
  );
}

