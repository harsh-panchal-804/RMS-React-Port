import React, { useEffect, useState } from "react";
import { SparklesCore } from "@/components/ui/sparkles";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  authenticatedRequest,
  getAllProjects,
  getPendingAttendanceRequests,
} from "@/utils/api";

export default function Home() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState({
    pendingTimeSheets: 0,
    pendingAttendance: 0,
    totalProjects: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      if (!token) return;
      setLoadingStats(true);
      try {
        const [pendingTimeSheets, pendingAttendance, projects] = await Promise.all([
          authenticatedRequest("GET", "/admin/dashboard/pending-approvals"),
          getPendingAttendanceRequests(),
          getAllProjects(),
        ]);

        if (!isMounted) return;

        setStats({
          pendingTimeSheets: Array.isArray(pendingTimeSheets) ? pendingTimeSheets.length : 0,
          pendingAttendance: Array.isArray(pendingAttendance) ? pendingAttendance.length : 0,
          totalProjects: Array.isArray(projects) ? projects.length : 0,
        });
      } catch (error) {
        if (!isMounted) return;
        setStats({
          pendingTimeSheets: 0,
          pendingAttendance: 0,
          totalProjects: 0,
        });
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const statCards = [
    {
      label: "Pending Time Sheet Approvals",
      value: stats.pendingTimeSheets,
      path: "/time-sheet-approvals",
      description: "Items waiting for review",
    },
    {
      label: "Pending Attendance Requests",
      value: stats.pendingAttendance,
      path: "/attendance-approvals",
      description: "Leave/WFH requests pending",
    },
    {
      label: "Active Projects",
      value: stats.totalProjects,
      path: "/project-management",
      description: "Projects currently configured",
    },
    {
      label: "Open Resource Allocation",
      value: "View",
      path: "/project-resource-allocation",
      description: "Check team allocation status",
    },
  ];

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden pt-[22vh] px-4 pb-10">
      <div className="font-playfair text-center text-white/85 font-light relative z-20">
        <h1 className="text-3xl md:text-5xl font-extralight tracking-tight">
          Welcome, {user?.name || "User"}
        </h1>

        <div className="w-[40rem] h-40 relative mt-3">
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={1200}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />

          <div className="absolute inset-0 w-full h-full bg-black [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]" />
        </div>

      </div>

      <div className="relative z-20 mt-8 w-full max-w-5xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {statCards.map((card) => (
            <Link
              key={card.path}
              to={card.path}
              className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <CardSpotlight className="h-full min-h-36 border-white/20 bg-white/5 p-4">
                <p className="relative z-20 text-sm text-white/75">{card.label}</p>
                <p className="relative z-20 mt-1 text-2xl font-semibold text-white">
                  {loadingStats && typeof card.value === "number" ? "..." : card.value}
                </p>
                <p className="relative z-20 mt-1 text-xs text-white/60">{card.description}</p>
              </CardSpotlight>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
