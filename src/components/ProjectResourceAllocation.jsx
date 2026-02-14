import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  getAllProjects,
  getAllUsers,
  getUsersWithFilter,
  getProjectMetrics,
  getProjectAllocation,
  getUserNameMapping,
} from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HoverEffect } from '@/components/ui/card-hover-effect';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LoaderThreeDemo } from './LoaderDemo';
import { useFiltersUpdatedToast } from '@/hooks/useFiltersUpdatedToast';
import {
  RefreshCw,
  Download,
  Users,
  Calendar as CalendarIcon,
  Clock,
  Target,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Search,
  FolderOpen,
  ClipboardList,
  Info,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const WORK_ROLE_OPTIONS = [
  'ANNOTATION',
  'QC',
  'LIVE_QC',
  'RETRO_QC',
  'PM',
  'APM',
  'RPM',
];

const LEAVE_STATUSES = new Set(['LEAVE', 'ON_LEAVE', 'HALF_DAY_LEAVE']);

const normalizeRole = (role) => {
  if (role && typeof role === 'object') {
    if (role.value) return String(role.value).toUpperCase();
    if (role.name) return String(role.name).toUpperCase();
  }
  return String(role || '').toUpperCase();
};

const normalizeWeekoffValue = (value) => {
  if (typeof value === 'string') return value.toUpperCase().trim();
  if (value && typeof value === 'object') {
    return String(value.value || value.name || '').toUpperCase().trim();
  }
  return '';
};

const ProjectResourceAllocation = () => {
  const { user, token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [hoveredOverallIndex, setHoveredOverallIndex] = useState(null);
  
  // Data states
  const [allProjects, setAllProjects] = useState([]);
  const [usersData, setUsersData] = useState([]);
  const [allUsersData, setAllUsersData] = useState([]);
  const [projectMetrics, setProjectMetrics] = useState({});
  const [projectAllocations, setProjectAllocations] = useState({});
  const [userNameMapping, setUserNameMapping] = useState({});
  
  // Dialog states
  const [showUserListDialog, setShowUserListDialog] = useState(false);
  const [userListData, setUserListData] = useState([]);
  const [userListTitle, setUserListTitle] = useState('');
  const [userListType, setUserListType] = useState('');
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [projectDialogData, setProjectDialogData] = useState(null);
  const [projectDialogType, setProjectDialogType] = useState('');

  // Check role access
  useEffect(() => {
    if (user && user.role && !['ADMIN', 'MANAGER'].includes(user.role)) {
      toast.error('Access denied. Admin or Manager role required.');
    }
  }, [user]);

  // Fetch all data
  const fetchAllData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Fetch in parallel
      const [projects, usersWithFilter, allUsers, nameMapping] = await Promise.all([
        getAllProjects(),
        getUsersWithFilter(dateStr),
        getAllUsers({ limit: 1000 }),
        getUserNameMapping(),
      ]);

      const fallbackUsers = Array.isArray(allUsers) ? allUsers : [];
      let users = Array.isArray(usersWithFilter) ? usersWithFilter : [];
      if (users.length === 0 && fallbackUsers.length > 0) {
        users = fallbackUsers.map((u) => ({
          ...u,
          allocated_projects: u.allocated_projects || 0,
          is_not_allocated: Boolean(u.is_not_allocated),
          today_status: u.today_status || 'ABSENT',
        }));
      }
      
      setAllProjects(projects);
      setUsersData(users);
      setAllUsersData(fallbackUsers);
      setUserNameMapping(nameMapping);
      
      // Fetch metrics and allocations for each project
      const metricsPromises = projects.map(async (project) => {
        const metrics = await getProjectMetrics(project.id, dateStr, dateStr);
        let allocation = await getProjectAllocation(project.id, dateStr, true);
        const hasActiveAllocation =
          allocation &&
          ((Array.isArray(allocation.resources) && allocation.resources.length > 0) ||
            Number(allocation.total_resources || 0) > 0);
        if (!hasActiveAllocation) {
          const allocationWithInactive = await getProjectAllocation(project.id, dateStr, false);
          if (allocationWithInactive) {
            allocation = allocationWithInactive;
          }
        }
        return { projectId: project.id, metrics, allocation };
      });
      
      const results = await Promise.all(metricsPromises);
      const metricsMap = {};
      const allocationsMap = {};
      
      results.forEach(({ projectId, metrics, allocation }) => {
        metricsMap[projectId] = metrics;
        allocationsMap[projectId] = allocation;
      });
      
      setProjectMetrics(metricsMap);
      setProjectAllocations(allocationsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      await fetchAllData();
      if (isMounted) {
        setInitialLoading(false);
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  // Streamlit-parity user KPI logic
  const userKpiData = useMemo(() => {
    const validUsers = Array.isArray(usersData)
      ? usersData.filter((u) => u && typeof u === 'object')
      : [];
    const todayWeekday = format(selectedDate, 'EEEE').toUpperCase();

    let userRoleUsers = validUsers.filter((u) => normalizeRole(u.role) === 'USER');
    // Streamlit fallback: if no USER role found, use all users
    if (validUsers.length > 0 && userRoleUsers.length === 0) {
      userRoleUsers = validUsers;
    }

    const weekoffMap = new Map();
    (allUsersData || []).forEach((u) => {
      const userId = String(u?.id || '').trim();
      if (!userId) return;
      const normalizedWeekoffs = (u?.weekoffs || [])
        .map(normalizeWeekoffValue)
        .filter(Boolean);
      if (normalizedWeekoffs.length === 0) return;
      weekoffMap.set(userId, normalizedWeekoffs);
      weekoffMap.set(userId.toLowerCase(), normalizedWeekoffs);
      weekoffMap.set(userId.toUpperCase(), normalizedWeekoffs);
      weekoffMap.set(userId.replace(/-/g, ''), normalizedWeekoffs);
      weekoffMap.set(userId.replace(/-/g, '').toLowerCase(), normalizedWeekoffs);
    });

    const resolveWeekoffs = (u) => {
      const userId = String(u?.id || u?.user_id || '').trim();
      if (!userId) return [];
      return (
        weekoffMap.get(userId) ||
        weekoffMap.get(userId.toLowerCase()) ||
        weekoffMap.get(userId.toUpperCase()) ||
        weekoffMap.get(userId.replace(/-/g, '')) ||
        weekoffMap.get(userId.replace(/-/g, '').toLowerCase()) ||
        (u?.weekoffs || []).map(normalizeWeekoffValue).filter(Boolean)
      );
    };

    const presentUsers = [];
    const absentUsers = [];
    const leaveUsers = [];
    const weekoffUsers = [];

    userRoleUsers.forEach((u) => {
      const status = String(u?.today_status || '').toUpperCase();
      const isWeekoffToday = resolveWeekoffs(u).includes(todayWeekday);

      if (status === 'PRESENT') {
        presentUsers.push(u);
        return;
      }
      if (isWeekoffToday && !LEAVE_STATUSES.has(status)) {
        weekoffUsers.push({ ...u, today_status: 'WEEKOFF' });
        return;
      }
      if (LEAVE_STATUSES.has(status)) {
        leaveUsers.push(u);
        return;
      }
      // Streamlit counts WFH and unknown statuses as Absent
      absentUsers.push(u);
    });

    const allocatedUsers = userRoleUsers.filter((u) => !Boolean(u?.is_not_allocated));
    const notAllocatedUsers = userRoleUsers.filter((u) => Boolean(u?.is_not_allocated));

    return {
      userRoleUsers,
      presentUsers,
      absentUsers,
      leaveUsers,
      weekoffUsers,
      allocatedUsers,
      notAllocatedUsers,
    };
  }, [usersData, allUsersData, selectedDate]);

  const userStats = useMemo(() => {
    return {
      total: userKpiData.userRoleUsers.length,
      present: userKpiData.presentUsers.length,
      absent: userKpiData.absentUsers.length,
      leave: userKpiData.leaveUsers.length,
      allocated: userKpiData.allocatedUsers.length,
      notAllocated: userKpiData.notAllocatedUsers.length,
      weekoff: userKpiData.weekoffUsers.length,
    };
  }, [userKpiData]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    let totalHours = 0;
    let totalTasks = 0;
    
    Object.values(projectMetrics).forEach(metrics => {
      metrics.forEach(m => {
        totalHours += m.hours_worked || 0;
        totalTasks += m.tasks_completed || 0;
      });
    });

    return { totalHours, totalTasks };
  }, [projectMetrics]);

  // Format duration helper
  const formatDuration = (totalSeconds) => {
    if (!totalSeconds || totalSeconds <= 0) return '-';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Format time helper
  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp);
      return format(date, 'hh:mm a');
    } catch {
      return '-';
    }
  };

  // Calculate hours worked
  const calculateHoursWorked = (clockIn, clockOut, minutesWorked) => {
    if (minutesWorked && minutesWorked > 0) {
      return formatDuration(Math.floor(minutesWorked * 60));
    }
    if (clockIn && clockOut) {
      try {
        const start = new Date(clockIn);
        const end = new Date(clockOut);
        const diffSeconds = Math.floor((end - start) / 1000);
        return formatDuration(diffSeconds);
      } catch {
        return '-';
      }
    }
    return '-';
  };

  // Aggregate by user
  const aggregateByUser = (resources) => {
    const aggregated = {};
    resources.forEach(r => {
      const uid = r.user_id;
      if (!aggregated[uid]) {
        aggregated[uid] = { ...r };
      } else {
        const existing = aggregated[uid];
        if (r.first_clock_in && (!existing.first_clock_in || new Date(r.first_clock_in) < new Date(existing.first_clock_in))) {
          existing.first_clock_in = r.first_clock_in;
        }
        if (r.last_clock_out && (!existing.last_clock_out || new Date(r.last_clock_out) > new Date(existing.last_clock_out))) {
          existing.last_clock_out = r.last_clock_out;
        }
        existing.minutes_worked = (existing.minutes_worked || 0) + (r.minutes_worked || 0);
        if (existing.attendance_status !== 'PRESENT') {
          existing.attendance_status = r.attendance_status;
        }
      }
    });
    return Object.values(aggregated);
  };

  // Export CSV
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  // Filter functions for user lists
  const getPresentUsers = () => userKpiData.presentUsers;
  const getAbsentUsers = () => userKpiData.absentUsers;
  const getLeaveUsers = () => userKpiData.leaveUsers;
  const getAllocatedUsers = () => userKpiData.allocatedUsers;
  const getNotAllocatedUsers = () => userKpiData.notAllocatedUsers;
  const getWeekoffUsers = () => userKpiData.weekoffUsers;

  // Get user projects mapping
  const getUserProjectsMapping = useMemo(() => {
    const mapping = {};
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    Object.entries(projectAllocations).forEach(([projectId, allocation]) => {
      const project = allProjects.find(p => p.id === projectId);
      const projectName = project?.name || 'Unknown Project';
      
      if (allocation?.resources) {
        allocation.resources.forEach(resource => {
          const userId = String(resource.user_id).trim();
          if (userId && userId !== 'None') {
            if (!mapping[userId]) {
              mapping[userId] = [];
            }
            if (!mapping[userId].includes(projectName)) {
              mapping[userId].push(projectName);
            }
            // Also store with lowercase and no-dash variants for better matching
            const userIdLower = userId.toLowerCase();
            const userIdNoDashes = userId.replace(/-/g, '');
            if (!mapping[userIdLower]) mapping[userIdLower] = [];
            if (!mapping[userIdLower].includes(projectName)) {
              mapping[userIdLower].push(projectName);
            }
            if (!mapping[userIdNoDashes]) mapping[userIdNoDashes] = [];
            if (!mapping[userIdNoDashes].includes(projectName)) {
              mapping[userIdNoDashes].push(projectName);
            }
          }
        });
      }
    });
    
    return mapping;
  }, [projectAllocations, allProjects, selectedDate]);

  // Handle user list button click
  const handleUserListClick = (type, data) => {
    // Enhance data with project names for allocated users
    const enhancedData = type === 'allocated' ? data.map(user => {
      const userId = String(user.id || user.user_id || '').trim();
      const projects = getUserProjectsMapping[userId] || 
                      getUserProjectsMapping[userId?.toLowerCase()] ||
                      getUserProjectsMapping[userId?.replace(/-/g, '')] ||
                      [];
      return {
        ...user,
        allocated_projects_list: projects.join(', ') || 'No projects',
        allocated_projects_count: projects.length,
      };
    }) : data;
    
    setUserListData(enhancedData);
    setUserListType(type);
    setUserListTitle({
      total: 'All Users (Role: USER)',
      present: 'Present Users',
      absent: 'Absent Users',
      leave: 'Leave Users',
      allocated: 'Allocated Users',
      not_allocated: 'Not Allocated Users',
      weekoff: 'Users on Weekoff Today',
    }[type] || 'Users');
    setShowUserListDialog(true);
  };

  // Transform KPI cards into HoverEffect items format
  const kpiItems = useMemo(() => {
    return [
      {
        id: 'total-users',
        title: 'Total Users',
        value: userStats.total.toString(),
        icon: <Users className="h-4 w-4" />,
        description: 'All users with role USER',
        onClick: () => handleUserListClick('total', userKpiData.userRoleUsers),
      },
      {
        id: 'present',
        title: 'Present',
        value: userStats.present.toString(),
        icon: <UserCheck className="h-4 w-4" />,
        description: 'Users who are present today',
        onClick: () => handleUserListClick('present', getPresentUsers()),
      },
      {
        id: 'absent',
        title: 'Absent',
        value: userStats.absent.toString(),
        icon: <UserX className="h-4 w-4" />,
        description: 'Users who are absent today',
        onClick: () => handleUserListClick('absent', getAbsentUsers()),
      },
      {
        id: 'leave',
        title: 'Leave',
        value: userStats.leave.toString(),
        icon: <AlertCircle className="h-4 w-4" />,
        description: 'Users on leave today',
        onClick: () => handleUserListClick('leave', getLeaveUsers()),
      },
      {
        id: 'allocated',
        title: 'Allocated',
        value: userStats.allocated.toString(),
        icon: <Briefcase className="h-4 w-4" />,
        description: 'Users allocated to projects',
        onClick: () => handleUserListClick('allocated', getAllocatedUsers()),
      },
      {
        id: 'not-allocated',
        title: 'Not Allocated',
        value: userStats.notAllocated.toString(),
        icon: <Users className="h-4 w-4" />,
        description: 'Users not allocated to any project',
        onClick: () => handleUserListClick('not_allocated', getNotAllocatedUsers()),
      },
      {
        id: 'weekoff',
        title: 'Weekoff',
        value: userStats.weekoff.toString(),
        icon: <CalendarIcon className="h-4 w-4" />,
        description: 'Users on weekoff today',
        onClick: () => handleUserListClick('weekoff', getWeekoffUsers()),
      },
    ];
  }, [userStats, userKpiData, handleUserListClick, getUserProjectsMapping]);

  // Handle project card click
  const handleProjectClick = (type, projectData) => {
    setProjectDialogData(projectData);
    setProjectDialogType(type);
    setShowProjectDialog(true);
  };

  // Prepare project cards data
  const projectCardsData = useMemo(() => {
    return allProjects.map(project => {
      const metrics = projectMetrics[project.id] || [];
      const allocation = projectAllocations[project.id];
      
      const totalTasks = metrics.reduce((sum, m) => sum + (m.tasks_completed || 0), 0);
      const totalHours = metrics.reduce((sum, m) => sum + (m.hours_worked || 0), 0);
      
      // Count roles
      const roleCounts = {};
      metrics.forEach(m => {
        const role = m.work_role || 'Unknown';
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      });
      
      // Count users
      let totalUsers = 0;
      if (allocation?.resources) {
        const resources = aggregateByUser(allocation.resources);
        const userOnlyResources = resources.filter(
          (r) => String(r.designation || '').toUpperCase() === 'USER'
        );
        if (userOnlyResources.length > 0) {
          totalUsers = userOnlyResources.length;
        } else if (resources.length > 0) {
          totalUsers = resources.length;
        } else {
          totalUsers = Number(allocation.total_resources || 0);
        }
      }

      return {
        project,
        totalTasks,
        totalHours,
        roleCounts,
        totalUsers,
        metrics,
        allocation,
      };
    });
  }, [allProjects, projectMetrics, projectAllocations]);

  // Prepare visualization data
  const visualizationData = useMemo(() => {
    const hoursByProject = [];
    const tasksByProject = [];
    const hoursByRole = {};
    const tasksByRole = {};
    const projectRoleHeatmap = {};
    allProjects.forEach((project) => {
      const metricsRaw =
        projectMetrics[project.id] ??
        projectMetrics[String(project.id)] ??
        [];
      const metrics = Array.isArray(metricsRaw)
        ? metricsRaw
        : Array.isArray(metricsRaw?.data)
        ? metricsRaw.data
        : [];

      const projectName = project?.name || 'Unknown';
      let projHours = 0;
      let projTasks = 0;

      metrics.forEach((m) => {
        const hours = Number(m?.hours_worked || 0);
        const tasks = Number(m?.tasks_completed || 0);
        const role = m?.work_role || 'Unknown';

        projHours += hours;
        projTasks += tasks;

        hoursByRole[role] = (hoursByRole[role] || 0) + hours;
        tasksByRole[role] = (tasksByRole[role] || 0) + tasks;

        if (!projectRoleHeatmap[projectName]) {
          projectRoleHeatmap[projectName] = {};
        }
        projectRoleHeatmap[projectName][role] =
          (projectRoleHeatmap[projectName][role] || 0) + hours;
      });

      if (projHours > 0 || projTasks > 0) {
        hoursByProject.push({ project: projectName, hours: projHours });
        tasksByProject.push({ project: projectName, tasks: projTasks });
      }
    });

    return {
      hoursByProject,
      tasksByProject,
      hoursByRole: Object.entries(hoursByRole).map(([role, hours]) => ({ role, hours })),
      tasksByRole: Object.entries(tasksByRole).map(([role, tasks]) => ({ role, tasks })),
      projectRoleHeatmap,
    };
  }, [projectMetrics, allProjects]);

  const globalFiltersSignature = useMemo(
    () => JSON.stringify({ selectedDate: format(selectedDate, 'yyyy-MM-dd') }),
    [selectedDate]
  );

  const globalDataSignature = useMemo(() => {
    const projectCount = allProjects.length;
    const usersCount = usersData.length;
    const metricsRowsCount = Object.values(projectMetrics).reduce(
      (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
      0
    );
    return `${projectCount}|${usersCount}|${metricsRowsCount}`;
  }, [allProjects, usersData, projectMetrics]);

  useFiltersUpdatedToast({
    filtersSignature: globalFiltersSignature,
    dataSignature: globalDataSignature,
    enabled: !loading && !initialLoading && Boolean(token),
    message: 'Filters updated',
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Admin or Manager role required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderThreeDemo />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Project Resource Allocation Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive resource allocation, attendance, and productivity overview
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Real-time Updates:</strong> Data refreshes automatically. Use the 'Refresh Data' button to see your latest tasks and hours immediately after completing work.
        </AlertDescription>
      </Alert>

      {/* Date Selector */}
      <div className="flex items-center gap-4">
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-[280px] justify-start text-left font-normal"
              onClick={() => setDatePickerOpen(!datePickerOpen)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setDatePickerOpen(false);
                }
              }}
              disabled={(date) => {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                return date > today;
              }}
              initialFocus
              defaultMonth={selectedDate}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview Dashboard
          </TabsTrigger>
          <TabsTrigger value="visualizations" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Visualizations
          </TabsTrigger>
          <TabsTrigger value="detailed" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Detailed Project View
          </TabsTrigger>
        </TabsList>

        {/* Overview Dashboard Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* User Overview */}
          <div>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
              <Users className="h-6 w-6" />
              User Overview
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Dashboard showing Total users count with role 'USER', plus counts of present, absent, leave, allocated, not allocated, and weekoff
            </p>
            
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-20" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : kpiItems && kpiItems.length > 0 ? (
              <HoverEffect items={kpiItems} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-20" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Overall Statistics */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Overall Statistics
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-5 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-9 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className="relative group block p-2 h-full w-full"
                  onMouseEnter={() => setHoveredOverallIndex(0)}
                  onMouseLeave={() => setHoveredOverallIndex(null)}
                >
                  <AnimatePresence>
                    {hoveredOverallIndex === 0 && (
                      <motion.span
                        className="absolute inset-0 h-full w-full bg-slate-700 dark:bg-cyan-500 block rounded-3xl"
                        layoutId="hoverOverallBackground"
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          transition: { duration: 0.15 },
                        }}
                        exit={{
                          opacity: 0,
                          transition: { duration: 0.15, delay: 0.2 },
                        }}
                      />
                    )}
                  </AnimatePresence>
                  <Card className="relative z-20 h-full">
                    <CardHeader>
                      <CardTitle>Total Hours Worked</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{overallStats.totalHours.toFixed(2)} hrs</div>
                    </CardContent>
                  </Card>
                </div>
                <div 
                  className="relative group block p-2 h-full w-full"
                  onMouseEnter={() => setHoveredOverallIndex(1)}
                  onMouseLeave={() => setHoveredOverallIndex(null)}
                >
                  <AnimatePresence>
                    {hoveredOverallIndex === 1 && (
                      <motion.span
                        className="absolute inset-0 h-full w-full bg-slate-700 dark:bg-cyan-500 block rounded-3xl"
                        layoutId="hoverOverallBackground"
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          transition: { duration: 0.15 },
                        }}
                        exit={{
                          opacity: 0,
                          transition: { duration: 0.15, delay: 0.2 },
                        }}
                      />
                    )}
                  </AnimatePresence>
                  <Card className="relative z-20 h-full">
                    <CardHeader>
                      <CardTitle>Total Tasks Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{overallStats.totalTasks}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>

          {/* Project Cards */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <FolderOpen className="h-6 w-6" />
              Project Cards
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectCardsData.map(({ project, totalTasks, totalHours, roleCounts, totalUsers, metrics, allocation }) => (
                  <Card key={project.id} className="h-full">
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleProjectClick('tasks', { project, metrics, allocation })}
                        >
                          <Target className="h-4 w-4 mr-2" />
                          Tasks: {totalTasks}
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleProjectClick('hours', { project, metrics, allocation })}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Hours: {totalHours.toFixed(1)}
                        </Button>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium mb-2">Role Counts:</p>
                        <div className="space-y-1">
                          {Object.entries(roleCounts).slice(0, 4).map(([role, count]) => (
                            <Button
                              key={role}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => handleProjectClick('role', { project, role, metrics, allocation })}
                            >
                              {role}: {count}
                            </Button>
                          ))}
                          {Object.keys(roleCounts).length > 4 && (
                            <p className="text-xs text-muted-foreground">
                              +{Object.keys(roleCounts).length - 4} more role(s)
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleProjectClick('users', { project, metrics, allocation })}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Total Users: {totalUsers}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Visualizations Tab */}
        <TabsContent value="visualizations" className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Visualizations
          </h2>
          
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : visualizationData.hoursByProject.length === 0 &&
              visualizationData.tasksByProject.length === 0 &&
              visualizationData.hoursByRole.length === 0 &&
              visualizationData.tasksByRole.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No visualization data available for the selected date.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hours by Project */}
              <Card>
                <CardHeader>
                  <CardTitle>Total Hours Worked by Project</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      project: { label: 'Project' },
                      hours: { label: 'Hours', color: COLORS[0] },
                    }}
                    className="h-[360px] w-full"
                  >
                    <BarChart data={visualizationData.hoursByProject} margin={{ left: 12, right: 12, top: 12, bottom: 32 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="project" angle={-35} textAnchor="end" height={95} tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => Number(value || 0).toFixed(2)} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => `${name}: ${Number(value || 0).toFixed(2)}`}
                          />
                        }
                      />
                      <Bar dataKey="hours" fill={COLORS[0]} radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Tasks by Project */}
              <Card>
                <CardHeader>
                  <CardTitle>Total Tasks Completed by Project</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      project: { label: 'Project' },
                      tasks: { label: 'Tasks', color: COLORS[1] },
                    }}
                    className="h-[360px] w-full"
                  >
                    <BarChart data={visualizationData.tasksByProject} margin={{ left: 12, right: 12, top: 12, bottom: 32 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="project" angle={-35} textAnchor="end" height={95} tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => Number(value || 0).toFixed(2)} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => `${name}: ${Number(value || 0).toFixed(2)}`}
                          />
                        }
                      />
                      <Bar dataKey="tasks" fill={COLORS[1]} radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Hours by Role */}
              <Card>
                <CardHeader>
                  <CardTitle>Hours Worked by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      hours: { label: 'Hours', color: COLORS[0] },
                    }}
                    className="h-[380px] w-full"
                  >
                    <PieChart>
                      <Pie
                        data={visualizationData.hoursByRole}
                        dataKey="hours"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, value }) => `${name}: ${Number(value || 0).toFixed(2)}`}
                      >
                        {visualizationData.hoursByRole.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => `${name}: ${Number(value || 0).toFixed(2)}`}
                          />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Tasks by Role */}
              <Card>
                <CardHeader>
                  <CardTitle>Tasks Completed by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      tasks: { label: 'Tasks', color: COLORS[1] },
                    }}
                    className="h-[380px] w-full"
                  >
                    <PieChart>
                      <Pie
                        data={visualizationData.tasksByRole}
                        dataKey="tasks"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, value }) => `${name}: ${Number(value || 0).toFixed(2)}`}
                      >
                        {visualizationData.tasksByRole.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => `${name}: ${Number(value || 0).toFixed(2)}`}
                          />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Detailed Project View Tab */}
        <TabsContent value="detailed" className="space-y-6">
          <DetailedProjectView
            projects={allProjects}
            selectedDate={selectedDate}
            projectMetrics={projectMetrics}
            projectAllocations={projectAllocations}
            allUsersData={allUsersData}
            userNameMapping={userNameMapping}
            loading={loading}
            formatTime={formatTime}
            calculateHoursWorked={calculateHoursWorked}
            aggregateByUser={aggregateByUser}
            exportToCSV={exportToCSV}
          />
        </TabsContent>
      </Tabs>

      {/* User List Dialog */}
      <Dialog open={showUserListDialog} onOpenChange={setShowUserListDialog}>
        <DialogContent className="!w-[90vw] !max-w-[90vw] sm:!max-w-[90vw] max-h-[90vh] p-6">
          <DialogHeader className="pb-4">
            <div className="flex items-center justify-between pr-10">
              <div>
                <DialogTitle className="text-xl">{userListTitle}</DialogTitle>
                <DialogDescription className="text-base">
                  Showing {userListData.length} user(s) as of {format(selectedDate, 'MMMM dd, yyyy')}
                </DialogDescription>
              </div>
              <Button onClick={() => exportToCSV(userListData, userListTitle.replace(/\s+/g, '_'))} className="mr-0">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </DialogHeader>
          <div className="rounded-md border overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  <TableHead className="min-w-[150px] whitespace-nowrap">Name</TableHead>
                  <TableHead className="min-w-[200px] whitespace-nowrap">Email</TableHead>
                  <TableHead className="min-w-[120px] whitespace-nowrap">Work Role</TableHead>
                  <TableHead className="min-w-[100px] whitespace-nowrap">Status</TableHead>
                  {userListType === 'allocated' ? (
                    <>
                      <TableHead className="min-w-[300px] whitespace-nowrap">Allocated Projects</TableHead>
                      <TableHead className="min-w-[80px] text-center whitespace-nowrap">Count</TableHead>
                    </>
                  ) : (
                    <TableHead className="min-w-[100px] whitespace-nowrap">Projects</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {userListData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={userListType === 'allocated' ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  userListData.map((user, idx) => (
                    <TableRow key={user.id || user.user_id || idx} className="hover:bg-muted/50">
                      <TableCell className="font-medium whitespace-nowrap">{user.name || '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{user.email || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline">{user.work_role || '-'}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge 
                          variant={
                            user.today_status === 'PRESENT' ? 'outline' :
                            user.today_status === 'LEAVE' ? 'secondary' :
                            user.today_status === 'WEEKOFF' ? 'outline' : 'outline'
                          }
                          className={`whitespace-nowrap ${
                            user.today_status === 'PRESENT' 
                              ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                              : (user.today_status === 'ABSENT' || !user.today_status)
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : ''
                          }`}
                        >
                          {user.today_status || 'ABSENT'}
                        </Badge>
                      </TableCell>
                      {userListType === 'allocated' ? (
                        <>
                          <TableCell className="text-sm">
                            {user.allocated_projects_list || user.allocated_projects || 'No projects'}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {user.allocated_projects_count !== undefined 
                              ? user.allocated_projects_count 
                              : (user.allocated_projects || 0)}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="text-sm whitespace-nowrap">
                          {user.allocated_projects || 0}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-start items-center mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Total: {userListData.length} user(s)
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="!w-[90vw] !max-w-[90vw] sm:!max-w-[90vw] max-h-[90vh] p-6">
          {projectDialogData && projectDialogData.project ? (
            <>
              <DialogHeader className="pb-4">
                <div className="flex items-center justify-between pr-10">
                  <DialogTitle className="text-xl">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      {projectDialogType === 'tasks' && `Tasks Details - ${projectDialogData.project.name}`}
                      {projectDialogType === 'hours' && `Hours Details - ${projectDialogData.project.name}`}
                      {projectDialogType === 'role' && `Role Details - ${projectDialogData.project.name} - ${projectDialogData.role}`}
                      {projectDialogType === 'users' && `Users in Project - ${projectDialogData.project.name}`}
                    </span>
                  </DialogTitle>
                  <Button onClick={() => {
                    const filename = `${projectDialogData.project.name}_${projectDialogType}_${format(selectedDate, 'yyyy-MM-dd')}`;
                    // Get table data for export based on type
                    const tableData = [];
                    if (projectDialogType === 'tasks' && projectDialogData.metrics) {
                      projectDialogData.metrics.forEach(m => {
                        const userId = String(m.user_id);
                        const userName = userNameMapping[userId] || 'Unknown';
                        tableData.push({
                          user_name: userName,
                          tasks_completed: m.tasks_completed || 0,
                          hours_worked: m.hours_worked || 0,
                          work_role: m.work_role || 'Unknown',
                        });
                      });
                    } else if (projectDialogType === 'hours' && projectDialogData.metrics) {
                      projectDialogData.metrics.forEach(m => {
                        const userId = String(m.user_id);
                        const userName = userNameMapping[userId] || 'Unknown';
                        tableData.push({
                          user_name: userName,
                          hours_worked: m.hours_worked || 0,
                          tasks_completed: m.tasks_completed || 0,
                          work_role: m.work_role || 'Unknown',
                        });
                      });
                    } else if (projectDialogType === 'role' && projectDialogData.metrics) {
                      projectDialogData.metrics
                        .filter(m => m.work_role === projectDialogData.role)
                        .forEach(m => {
                          const userId = String(m.user_id);
                          const userName = userNameMapping[userId] || 'Unknown';
                          tableData.push({
                            user_name: userName,
                            work_role: m.work_role || 'Unknown',
                            hours_worked: m.hours_worked || 0,
                            tasks_completed: m.tasks_completed || 0,
                          });
                        });
                    } else if (projectDialogType === 'users' && projectDialogData.allocation?.resources) {
                      const resources = aggregateByUser(projectDialogData.allocation.resources);
                      const userOnlyResources = resources.filter(
                        (r) => String(r.designation || '').toUpperCase() === 'USER'
                      );
                      const resourcesForDisplay = userOnlyResources.length > 0 ? userOnlyResources : resources;
                      resourcesForDisplay.forEach(r => {
                        const userMetrics = (projectDialogData.metrics || []).filter(m => String(m.user_id) === String(r.user_id));
                        const totalHours = userMetrics.reduce((sum, m) => sum + (m.hours_worked || 0), 0);
                        const totalTasks = userMetrics.reduce((sum, m) => sum + (m.tasks_completed || 0), 0);
                        tableData.push({
                          name: r.name || '-',
                          email: r.email || '-',
                          designation: r.designation || '-',
                          work_role: r.work_role || '-',
                          attendance_status: r.attendance_status || '-',
                          total_hours_clocked: totalHours.toFixed(2),
                          total_tasks_performed: totalTasks,
                        });
                      });
                    }
                    if (tableData.length > 0) {
                      exportToCSV(tableData, filename);
                    } else {
                      toast.error('No data to export');
                    }
                  }} className="mr-0">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </DialogHeader>
              <div className="rounded-md border overflow-auto max-h-[70vh]">
                <ProjectDialogContent
                  type={projectDialogType}
                  data={projectDialogData}
                  userNameMapping={userNameMapping}
                  selectedDate={selectedDate}
                  aggregateByUser={aggregateByUser}
                />
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No data available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Detailed Project View Component
const DetailedProjectView = ({
  projects,
  selectedDate,
  projectMetrics,
  projectAllocations,
  allUsersData,
  userNameMapping,
  loading,
  formatTime,
  calculateHoursWorked,
  aggregateByUser,
  exportToCSV,
}) => {
  const [selectedProject, setSelectedProject] = useState('All');
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [workRoleFilter, setWorkRoleFilter] = useState('ALL');

  const filteredData = useMemo(() => {
    if (selectedProject === 'All') return null;

    const project = projects.find(p => p.name === selectedProject);
    if (!project) return null;

    const allocation = projectAllocations[project.id];
    if (!allocation?.resources) return null;

    let resources = aggregateByUser(allocation.resources);

    // Build weekoff lookup (same normalization approach as overview logic)
    const detailWeekday = format(selectedDate, 'EEEE').toUpperCase();
    const userWeekoffsMap = new Map();
    (allUsersData || []).forEach((u) => {
      const userId = String(u?.id || '').trim();
      if (!userId) return;
      const normalizedWeekoffs = (u?.weekoffs || [])
        .map(normalizeWeekoffValue)
        .filter(Boolean);
      if (!normalizedWeekoffs.length) return;
      userWeekoffsMap.set(userId, normalizedWeekoffs);
      userWeekoffsMap.set(userId.toLowerCase(), normalizedWeekoffs);
      userWeekoffsMap.set(userId.toUpperCase(), normalizedWeekoffs);
      userWeekoffsMap.set(userId.replace(/-/g, ''), normalizedWeekoffs);
      userWeekoffsMap.set(userId.replace(/-/g, '').toLowerCase(), normalizedWeekoffs);
    });

    // Normalize status exactly like Streamlit detailed-view logic
    const normalizedResources = resources.map((r) => {
      const userId = String(r?.user_id || '').trim();
      const attendanceStatus = String(r?.attendance_status || 'ABSENT').toUpperCase();
      const userWeekoffs =
        userWeekoffsMap.get(userId) ||
        userWeekoffsMap.get(userId.toLowerCase()) ||
        userWeekoffsMap.get(userId.toUpperCase()) ||
        userWeekoffsMap.get(userId.replace(/-/g, '')) ||
        userWeekoffsMap.get(userId.replace(/-/g, '').toLowerCase()) ||
        [];
      const isWeekoff = userWeekoffs.includes(detailWeekday);

      let normalizedStatus = attendanceStatus;
      if (attendanceStatus === 'WFH') normalizedStatus = 'ABSENT';
      else if (attendanceStatus === 'ON_LEAVE' || attendanceStatus === 'HALF_DAY_LEAVE') normalizedStatus = 'LEAVE';
      else if (!attendanceStatus) normalizedStatus = 'ABSENT';

      const displayStatus = isWeekoff && normalizedStatus !== 'PRESENT' ? 'WEEKOFF' : normalizedStatus;
      return {
        ...r,
        attendance_status_normalized: normalizedStatus,
        attendance_status_display: displayStatus,
        is_weekoff: isWeekoff,
      };
    });

    resources = normalizedResources;

    // Apply filters (status filter uses normalized status and excludes weekoff)
    if (designationFilter !== 'ALL') {
      resources = resources.filter(r => r.designation === designationFilter);
    }
    if (workRoleFilter !== 'ALL') {
      resources = resources.filter(r => r.work_role === workRoleFilter);
    }
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PRESENT') {
        resources = resources.filter((r) => r.attendance_status_normalized === 'PRESENT' && !r.is_weekoff);
      } else if (statusFilter === 'ABSENT') {
        resources = resources.filter((r) => r.attendance_status_normalized === 'ABSENT' && !r.is_weekoff);
      } else if (statusFilter === 'LEAVE') {
        resources = resources.filter((r) => r.attendance_status_normalized === 'LEAVE' && !r.is_weekoff);
      }
    }

    // Get metrics for tasks
    const metrics = projectMetrics[project.id] || [];
    const userTasksMap = {};
    metrics.forEach(m => {
      const userId = String(m.user_id).toLowerCase();
      if (!userTasksMap[userId]) {
        userTasksMap[userId] = [];
      }
      if (m.tasks_completed > 0) {
        userTasksMap[userId].push({
          work_role: m.work_role,
          tasks: m.tasks_completed,
        });
      }
    });

    // Prepare table data
    return resources.map(r => {
      const userId = String(r.user_id).toLowerCase();
      const taskDetails = userTasksMap[userId] || [];
      const tasksDoneStr = taskDetails.length > 0
        ? taskDetails.map(t => `${t.work_role}: ${t.tasks}`).join(' | ')
        : '-';
      const totalTasks = taskDetails.reduce((sum, t) => sum + t.tasks, 0);

      return {
        name: r.name || '-',
        email: r.email || '-',
        designation: r.designation || '-',
        work_role: r.work_role || '-',
        status: r.attendance_status_display || r.attendance_status_normalized || r.attendance_status || '-',
        status_normalized: r.attendance_status_normalized || 'ABSENT',
        is_weekoff: Boolean(r.is_weekoff),
        tasks_done: tasksDoneStr,
        total_tasks: totalTasks,
        clock_in: formatTime(r.first_clock_in),
        clock_out: formatTime(r.last_clock_out),
        hours_worked: calculateHoursWorked(r.first_clock_in, r.last_clock_out, r.minutes_worked),
        reporting_manager: r.reporting_manager || '-',
      };
    });
  }, [selectedProject, designationFilter, statusFilter, workRoleFilter, projects, projectAllocations, projectMetrics, aggregateByUser, formatTime, calculateHoursWorked, allUsersData, selectedDate]);

  const summary = useMemo(() => {
    if (!filteredData) return null;
    const nonWeekoff = filteredData.filter((r) => !r.is_weekoff);
    return {
      allocated: filteredData.length,
      present: nonWeekoff.filter((r) => r.status_normalized === 'PRESENT').length,
      absent: nonWeekoff.filter((r) => r.status_normalized === 'ABSENT').length,
      leave: nonWeekoff.filter((r) => r.status_normalized === 'LEAVE').length,
    };
  }, [filteredData]);

  const filtersSignature = useMemo(
    () =>
      JSON.stringify({
        selectedProject,
        designationFilter,
        statusFilter,
        workRoleFilter,
      }),
    [selectedProject, designationFilter, statusFilter, workRoleFilter]
  );

  const dataSignature = useMemo(() => {
    const rows = filteredData || [];
    const totalTasks = rows.reduce((sum, row) => sum + Number(row.total_tasks || 0), 0);
    return `${rows.length}|${totalTasks}`;
  }, [filteredData]);

  useFiltersUpdatedToast({
    filtersSignature,
    dataSignature,
    enabled: !loading,
    message: 'Filters updated',
  });

  const summaryKpiItems = useMemo(() => {
    if (!summary) return [];
    return [
      {
        id: 'detailed-allocated',
        title: 'Allocated',
        value: String(summary.allocated),
        icon: <Users className="h-4 w-4" />,
        description: 'Total allocated users',
      },
      {
        id: 'detailed-present',
        title: 'Present',
        value: String(summary.present),
        icon: <CheckCircle2 className="h-4 w-4" />,
        description: 'Users marked present',
      },
      {
        id: 'detailed-absent',
        title: 'Absent',
        value: String(summary.absent),
        icon: <UserX className="h-4 w-4" />,
        description: 'Users marked absent',
      },
      {
        id: 'detailed-leave',
        title: 'Leave',
        value: String(summary.leave),
        icon: <AlertTriangle className="h-4 w-4" />,
        description: 'Users on leave',
      },
    ];
  }, [summary]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Search className="h-6 w-6" />
        Detailed Project View
      </h2>
      
      {/* Filters */}
      {/** Project + other filters */}
      {/** Project filter moved to searchable combobox */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="project-select" className="text-sm font-medium">Project</Label>
          <Combobox
            items={['All', ...projects.map((project) => project.name).filter(Boolean)]}
            value={selectedProject}
            onValueChange={setSelectedProject}
          >
            <ComboboxInput placeholder="Select project" className="w-full" />
            <ComboboxContent>
              <ComboboxEmpty>No project found.</ComboboxEmpty>
              <ComboboxList>
                {(item) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="space-y-2">
          <Label htmlFor="designation-select" className="text-sm font-medium">Designation</Label>
          <Select value={designationFilter} onValueChange={setDesignationFilter}>
            <SelectTrigger id="designation-select">
              <SelectValue placeholder="Designation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
              <SelectItem value="USER">USER</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-select" className="text-sm font-medium">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status-select">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              <SelectItem value="PRESENT">PRESENT</SelectItem>
              <SelectItem value="ABSENT">ABSENT</SelectItem>
              <SelectItem value="LEAVE">LEAVE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="work-role-select" className="text-sm font-medium">Work Role</Label>
          <Select value={workRoleFilter} onValueChange={setWorkRoleFilter}>
            <SelectTrigger id="work-role-select">
              <SelectValue placeholder="Work Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {WORK_ROLE_OPTIONS.map(role => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProject !== 'All' ? (
        summary ? (
          <>
            {/* Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Summary
              </h3>
              <HoverEffect items={summaryKpiItems} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
            </div>

          {/* Daily Roster */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Daily Roster
            </h3>
            <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Showing tasks completed by members on {format(selectedDate, 'MMMM dd, yyyy')}
            </p>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : filteredData && filteredData.length > 0 ? (
              <>
                <div className="rounded-md border overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 border-b">
                      <TableRow>
                        <TableHead className="min-w-[150px] whitespace-nowrap">Name</TableHead>
                        <TableHead className="min-w-[200px] whitespace-nowrap">Email</TableHead>
                        <TableHead className="min-w-[120px] whitespace-nowrap">Designation</TableHead>
                        <TableHead className="min-w-[120px] whitespace-nowrap">Work Role</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">Status</TableHead>
                        <TableHead className="min-w-[200px] whitespace-nowrap">Tasks Done</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">Total Tasks</TableHead>
                        <TableHead className="min-w-[120px] whitespace-nowrap">Clock In</TableHead>
                        <TableHead className="min-w-[120px] whitespace-nowrap">Clock Out</TableHead>
                        <TableHead className="min-w-[120px] whitespace-nowrap">Hours Worked</TableHead>
                        <TableHead className="min-w-[150px] whitespace-nowrap">Reporting Manager</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/50">
                          <TableCell className="font-medium whitespace-nowrap">{row.name}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{row.email}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.designation}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.work_role}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge 
                              variant="outline"
                              className={
                                row.status === 'PRESENT' 
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                  : row.status === 'ABSENT'
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                  : ''
                              }
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{row.tasks_done}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.total_tasks}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.clock_in}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.clock_out}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.hours_worked}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.reporting_manager}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4">
                  <Button onClick={() => exportToCSV(filteredData, `project_allocation_${selectedProject}`)}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            ) : selectedProject === 'All' ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Please select a project to view detailed allocation information.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No allocation data available for this project.
                </AlertDescription>
              </Alert>
            )}
          </div>
          </>
        ) : null
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Please select a project to view detailed allocation information.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Project Dialog Content Component
const ProjectDialogContent = ({ type, data, userNameMapping, selectedDate, aggregateByUser }) => {
  if (!data || !data.project) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No project data available
      </div>
    );
  }

  const { project, metrics, allocation, role } = data;

  if (type === 'tasks') {
    const taskList = (metrics || []).map(m => {
      const userId = String(m.user_id);
      const userName = userNameMapping[userId] || 'Unknown';
      return {
        user_name: userName,
        tasks_completed: m.tasks_completed || 0,
        hours_worked: m.hours_worked || 0,
        work_role: m.work_role || 'Unknown',
        user_id: userId,
      };
    });

    return (
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 border-b">
          <TableRow>
            <TableHead className="min-w-[150px] whitespace-nowrap">User Name</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Tasks Completed</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Hours Worked</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Work Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {taskList.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.user_name}</TableCell>
              <TableCell>{item.tasks_completed}</TableCell>
              <TableCell>{item.hours_worked.toFixed(2)}</TableCell>
              <TableCell>{item.work_role}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === 'hours') {
    const hoursList = (metrics || []).map(m => {
      const userId = String(m.user_id);
      const userName = userNameMapping[userId] || 'Unknown';
      return {
        user_name: userName,
        hours_worked: m.hours_worked || 0,
        tasks_completed: m.tasks_completed || 0,
        work_role: m.work_role || 'Unknown',
        user_id: userId,
      };
    });

    return (
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 border-b">
          <TableRow>
            <TableHead className="min-w-[150px] whitespace-nowrap">User Name</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Hours Worked</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Tasks Completed</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Work Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hoursList.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.user_name}</TableCell>
              <TableCell>{item.hours_worked.toFixed(2)}</TableCell>
              <TableCell>{item.tasks_completed}</TableCell>
              <TableCell>{item.work_role}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === 'role') {
    const roleList = (metrics || [])
      .filter(m => m.work_role === role)
      .map(m => {
        const userId = String(m.user_id);
        const userName = userNameMapping[userId] || 'Unknown';
        return {
          user_name: userName,
          user_id: userId,
          work_role: m.work_role || 'Unknown',
          hours_worked: m.hours_worked || 0,
          tasks_completed: m.tasks_completed || 0,
        };
      });

    return (
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 border-b">
          <TableRow>
            <TableHead className="min-w-[150px] whitespace-nowrap">User Name</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Work Role</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Hours Worked</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Tasks Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roleList.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.user_name}</TableCell>
              <TableCell>{item.work_role}</TableCell>
              <TableCell>{item.hours_worked.toFixed(2)}</TableCell>
              <TableCell>{item.tasks_completed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === 'users') {
    if (!allocation?.resources) {
      return <p>No allocation data available.</p>;
    }

    const resources = aggregateByUser(allocation.resources);
    const userOnlyResources = resources.filter(
      (r) => String(r.designation || '').toUpperCase() === 'USER'
    );
    const resourcesForDisplay = userOnlyResources.length > 0 ? userOnlyResources : resources;

    const userList = resourcesForDisplay.map(r => {
      const userMetrics = (metrics || []).filter(m => String(m.user_id) === String(r.user_id));
      const totalHours = userMetrics.reduce((sum, m) => sum + (m.hours_worked || 0), 0);
      const totalTasks = userMetrics.reduce((sum, m) => sum + (m.tasks_completed || 0), 0);

      return {
        name: r.name || '-',
        email: r.email || '-',
        designation: r.designation || '-',
        work_role: r.work_role || '-',
        attendance_status: r.attendance_status || '-',
        total_hours_clocked: totalHours.toFixed(2),
        total_tasks_performed: totalTasks,
      };
    });

    return (
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 border-b">
          <TableRow>
            <TableHead className="min-w-[150px] whitespace-nowrap">Name</TableHead>
            <TableHead className="min-w-[200px] whitespace-nowrap">Email</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Designation</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Work Role</TableHead>
            <TableHead className="min-w-[100px] whitespace-nowrap">Status</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Total Hours</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Total Tasks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userList.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.email}</TableCell>
              <TableCell>{item.designation}</TableCell>
              <TableCell>{item.work_role}</TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={
                    item.attendance_status === 'PRESENT' 
                      ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                      : item.attendance_status === 'ABSENT'
                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : ''
                  }
                >
                  {item.attendance_status}
                </Badge>
              </TableCell>
              <TableCell>{item.total_hours_clocked}</TableCell>
              <TableCell>{item.total_tasks_performed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return null;
};

export default ProjectResourceAllocation;
