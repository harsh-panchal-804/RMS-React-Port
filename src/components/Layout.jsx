"use client";
import React, { useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import {
  IconBrandTabler,
  IconHome,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Settings } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import ProjectProductivityDashboard from "./Dashboard";
import UserProductivityDashboard from "./UserDashboard";
import Home from "./Home";
import NotFound from "./NotFound";
import deccanLogo from "@/assets/o9v0brYfHVytUv8NJzPm2Tuymi0.webp";
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
  
  // Check if current route should hide sidebar (404 page)
  const validRoutes = ["/", "/dashboard", "/user-dashboard", "/404"];
  const is404Page = !validRoutes.includes(location.pathname) || location.pathname === "/404";

  const links = [
    {
      label: "Home",
      path: "/",
      icon: (
        <IconHome className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Project Productivity Dashboard",
      path: "/dashboard",
      icon: (
        <IconBrandTabler className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "User Productivity Dashboard",
      path: "/user-dashboard",
      icon: (
        <IconBrandTabler className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "404 Page (Demo)",
      path: "/404",
      icon: (
        <IconAlertTriangle className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
  ];
  
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
      style={{ "--sidebar-width": "22rem", "--sidebar-width-icon": "3rem" }}
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<ProjectProductivityDashboard />} />
              <Route path="/user-dashboard" element={<UserProductivityDashboard />} />
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
        className="h-6 w-6 shrink-0 object-contain"
        style={{ filter: 'brightness(0) invert(1)' }}
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

