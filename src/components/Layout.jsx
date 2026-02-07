"use client";
import React, { useState } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import {
  IconBrandTabler,
  IconHome,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import ProjectProductivityDashboard from "./Dashboard";
import UserProductivityDashboard from "./UserDashboard";
import Home from "./Home";
import deccanLogo from "@/assets/o9v0brYfHVytUv8NJzPm2Tuymi0.webp";

export function Layout() {
  const [currentPage, setCurrentPage] = useState("home");
  const [hoverOpen, setHoverOpen] = useState(false);

  const links = [
    {
      label: "Home",
      page: "home",
      icon: (
        <IconHome className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Project Productivity Dashboard",
      page: "dashboard",
      icon: (
        <IconBrandTabler className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "User Productivity Dashboard",
      page: "user-dashboard",
      icon: (
        <IconBrandTabler className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
  ];

  const handleLinkClick = (page) => {
    setCurrentPage(page);
  };
  
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
                      className={cn(
                        "w-full justify-start",
                        currentPage === link.page && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                      onClick={() => handleLinkClick(link.page)}
                    >
                      <div className="flex items-center gap-2">
                        {link.icon}
                        <span className="text-sm">
                          {link.label}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex-1 w-full">
          {currentPage === "home" ? (
            <Home />
          ) : currentPage === "dashboard" ? (
            <ProjectProductivityDashboard />
          ) : (
            <UserProductivityDashboard />
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function SidebarLogo() {
  const { state } = useSidebar();
  const open = state === "expanded";
  
  return (
    <a
      href="#"
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
    </a>
  );
}

