import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  getAllProjects,
  getUsersWithFilter,
  getProjectMetrics,
  getProjectAllocation,
  authenticatedRequest,
  getUserNameMapping,
} from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw,
  Download,
  Users,
  Calendar as CalendarIcon,
  Clock,
  Target,
  AlertCircle,
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

const ProjectResourceAllocation = () => {
  const { user, token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [allProjects, setAllProjects] = useState([]);
  const [usersData, setUsersData] = useState([]);
  const [projectMetrics, setProjectMetrics] = useState({});
  const [projectAllocations, setProjectAllocations] = useState({});
  const [userNameMapping, setUserNameMapping] = useState({});
  
  // Dialog states
  const [showUserListDialog, setShowUserListDialog] = useState(false);
  const [userListData, setUserListData] = useState([]);
  const [userListTitle, setUserListTitle] = useState('');
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
      const [projects, users, nameMapping] = await Promise.all([
        getAllProjects(),
        getUsersWithFilter(dateStr),
        getUserNameMapping(),
      ]);
      
      setAllProjects(projects);
      setUsersData(users);
      setUserNameMapping(nameMapping);
      
      // Fetch metrics and allocations for each project
      const metricsPromises = projects.map(async (project) => {
        const [metrics, allocation] = await Promise.all([
          getProjectMetrics(project.id, dateStr, dateStr),
          getProjectAllocation(project.id, dateStr, true),
        ]);
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
    fetchAllData();
  }, [selectedDate, token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  // Calculate user statistics
  const userStats = useMemo(() => {
    if (!usersData.length) {
      return {
        total: 0,
        present: 0,
        absent: 0,
        leave: 0,
        allocated: 0,
        notAllocated: 0,
        weekoff: 0,
      };
    }

    const todayWeekday = format(selectedDate, 'EEEE').toUpperCase();
    const present = usersData.filter(u => u.today_status === 'PRESENT').length;
    const leave = usersData.filter(u => u.today_status === 'LEAVE').length;
    const absent = usersData.filter(u => 
      !u.today_status || 
      (u.today_status !== 'PRESENT' && u.today_status !== 'LEAVE' && u.today_status !== 'WEEKOFF')
    ).length;
    const allocated = usersData.filter(u => (u.allocated_projects || 0) > 0).length;
    const notAllocated = usersData.filter(u => (u.allocated_projects || 0) === 0).length;
    
    // Calculate weekoff (users with weekoff today)
    const weekoff = usersData.filter(u => {
      const weekoffs = u.weekoffs || [];
      return weekoffs.some(w => {
        const day = typeof w === 'string' ? w.toUpperCase() : (w.value || w.name || '').toUpperCase();
        return day === todayWeekday && u.today_status !== 'PRESENT';
      });
    }).length;

    return {
      total: usersData.length,
      present,
      absent,
      leave,
      allocated,
      notAllocated,
      weekoff,
    };
  }, [usersData, selectedDate]);

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
  const getPresentUsers = () => usersData.filter(u => u.today_status === 'PRESENT');
  const getAbsentUsers = () => usersData.filter(u => !u.today_status || (u.today_status !== 'PRESENT' && u.today_status !== 'LEAVE' && u.today_status !== 'WEEKOFF'));
  const getLeaveUsers = () => usersData.filter(u => u.today_status === 'LEAVE');
  const getAllocatedUsers = () => usersData.filter(u => (u.allocated_projects || 0) > 0);
  const getNotAllocatedUsers = () => usersData.filter(u => (u.allocated_projects || 0) === 0);
  const getWeekoffUsers = () => {
    const todayWeekday = format(selectedDate, 'EEEE').toUpperCase();
    return usersData.filter(u => {
      const weekoffs = u.weekoffs || [];
      return weekoffs.some(w => {
        const day = typeof w === 'string' ? w.toUpperCase() : (w.value || w.name || '').toUpperCase();
        return day === todayWeekday && u.today_status !== 'PRESENT';
      });
    });
  };

  // Handle user list button click
  const handleUserListClick = (type, data) => {
    setUserListData(data);
    setUserListTitle({
      total: 'All Users (Role: USER or ADMIN)',
      present: 'Present Users',
      absent: 'Absent Users',
      leave: 'Leave Users',
      allocated: 'Allocated Users',
      not_allocated: 'Not Allocated Users',
      weekoff: 'Users on Weekoff Today',
    }[type] || 'Users');
    setShowUserListDialog(true);
  };

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
        totalUsers = resources.filter(r => 
          ['USER', 'ADMIN'].includes((r.designation || '').toUpperCase())
        ).length;
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

    Object.entries(projectMetrics).forEach(([projectId, metrics]) => {
      const project = allProjects.find(p => p.id === projectId);
      const projectName = project?.name || 'Unknown';
      
      let projHours = 0;
      let projTasks = 0;
      
      metrics.forEach(m => {
        const hours = m.hours_worked || 0;
        const tasks = m.tasks_completed || 0;
        const role = m.work_role || 'Unknown';
        
        projHours += hours;
        projTasks += tasks;
        
        hoursByRole[role] = (hoursByRole[role] || 0) + hours;
        tasksByRole[role] = (tasksByRole[role] || 0) + tasks;
        
        if (!projectRoleHeatmap[projectName]) {
          projectRoleHeatmap[projectName] = {};
        }
        projectRoleHeatmap[projectName][role] = (projectRoleHeatmap[projectName][role] || 0) + hours;
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Project Resource Allocation Dashboard</h1>
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">📊 Overview Dashboard</TabsTrigger>
          <TabsTrigger value="visualizations">📈 Visualizations</TabsTrigger>
          <TabsTrigger value="detailed">🔍 Detailed Project View</TabsTrigger>
        </TabsList>

        {/* Overview Dashboard Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* User Overview */}
          <div>
            <h2 className="text-2xl font-semibold mb-2">👥 User Overview</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Dashboard showing Total users count with role 'USER' or 'ADMIN', Count of present, absent, leave, allocated, not allocated, and weekoff
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => handleUserListClick('total', usersData)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userStats.total}</div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => handleUserListClick('present', getPresentUsers())}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Present</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{userStats.present}</div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => handleUserListClick('absent', getAbsentUsers())}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Absent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{userStats.absent}</div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => handleUserListClick('leave', getLeaveUsers())}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Leave</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{userStats.leave}</div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => handleUserListClick('allocated', getAllocatedUsers())}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Allocated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{userStats.allocated}</div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => handleUserListClick('not_allocated', getNotAllocatedUsers())}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Not Allocated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-600">{userStats.notAllocated}</div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => handleUserListClick('weekoff', getWeekoffUsers())}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Weekoff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{userStats.weekoff}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Overall Statistics */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">📊 Overall Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Hours Worked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{overallStats.totalHours.toFixed(2)} hrs</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Tasks Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{overallStats.totalTasks}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Project Cards */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">📁 Project Cards</h2>
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
          <h2 className="text-2xl font-semibold">📈 Visualizations</h2>
          
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hours by Project */}
              <Card>
                <CardHeader>
                  <CardTitle>Total Hours Worked by Project</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={visualizationData.hoursByProject}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="project" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tasks by Project */}
              <Card>
                <CardHeader>
                  <CardTitle>Total Tasks Completed by Project</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={visualizationData.tasksByProject}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="project" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="tasks" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Hours by Role */}
              <Card>
                <CardHeader>
                  <CardTitle>Hours Worked by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={visualizationData.hoursByRole}
                        dataKey="hours"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {visualizationData.hoursByRole.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tasks by Role */}
              <Card>
                <CardHeader>
                  <CardTitle>Tasks Completed by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={visualizationData.tasksByRole}
                        dataKey="tasks"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {visualizationData.tasksByRole.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
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
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{userListTitle}</DialogTitle>
            <DialogDescription>
              Showing {userListData.length} user(s)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Work Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Allocated Projects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userListData.map((user, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{user.name || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.work_role || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        user.today_status === 'PRESENT' ? 'default' :
                        user.today_status === 'LEAVE' ? 'secondary' :
                        user.today_status === 'WEEKOFF' ? 'outline' : 'destructive'
                      }>
                        {user.today_status || 'ABSENT'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.allocated_projects || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="flex justify-end mt-4">
            <Button onClick={() => exportToCSV(userListData, userListTitle.replace(/\s+/g, '_'))}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          {projectDialogData && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {projectDialogType === 'tasks' && `📋 Tasks Details - ${projectDialogData.project.name}`}
                  {projectDialogType === 'hours' && `📋 Hours Details - ${projectDialogData.project.name}`}
                  {projectDialogType === 'role' && `📋 Role Details - ${projectDialogData.project.name} - ${projectDialogData.role}`}
                  {projectDialogType === 'users' && `📋 Users in Project - ${projectDialogData.project.name}`}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <ProjectDialogContent
                  type={projectDialogType}
                  data={projectDialogData}
                  userNameMapping={userNameMapping}
                  selectedDate={selectedDate}
                />
              </ScrollArea>
              <div className="flex justify-end mt-4">
                <Button onClick={() => {
                  const filename = `${projectDialogData.project.name}_${projectDialogType}_${format(selectedDate, 'yyyy-MM-dd')}`;
                  // Export logic would go here
                  toast.info('Export functionality coming soon');
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </>
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
    
    // Apply filters
    if (designationFilter !== 'ALL') {
      resources = resources.filter(r => r.designation === designationFilter);
    }
    if (workRoleFilter !== 'ALL') {
      resources = resources.filter(r => r.work_role === workRoleFilter);
    }
    if (statusFilter !== 'ALL') {
      resources = resources.filter(r => r.attendance_status === statusFilter);
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
        status: r.attendance_status || '-',
        tasks_done: tasksDoneStr,
        total_tasks: totalTasks,
        clock_in: formatTime(r.first_clock_in),
        clock_out: formatTime(r.last_clock_out),
        hours_worked: calculateHoursWorked(r.first_clock_in, r.last_clock_out, r.minutes_worked),
        reporting_manager: r.reporting_manager || '-',
      };
    });
  }, [selectedProject, designationFilter, statusFilter, workRoleFilter, projects, projectAllocations, projectMetrics, aggregateByUser, formatTime, calculateHoursWorked]);

  const summary = useMemo(() => {
    if (!filteredData) return null;
    return {
      allocated: filteredData.length,
      present: filteredData.filter(r => r.status === 'PRESENT').length,
      absent: filteredData.filter(r => r.status === 'ABSENT').length,
      leave: filteredData.filter(r => r.status === 'LEAVE').length,
    };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">🔍 Detailed Project View</h2>
      
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger>
            <SelectValue placeholder="Select Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.name}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={designationFilter} onValueChange={setDesignationFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Designation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL</SelectItem>
            <SelectItem value="ADMIN">ADMIN</SelectItem>
            <SelectItem value="USER">USER</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL</SelectItem>
            <SelectItem value="PRESENT">PRESENT</SelectItem>
            <SelectItem value="ABSENT">ABSENT</SelectItem>
            <SelectItem value="LEAVE">LEAVE</SelectItem>
          </SelectContent>
        </Select>

        <Select value={workRoleFilter} onValueChange={setWorkRoleFilter}>
          <SelectTrigger>
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

      {selectedProject !== 'All' && summary && (
        <>
          {/* Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-4">📌 Summary</h3>
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Allocated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.allocated}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Present</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{summary.present}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Absent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{summary.absent}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Leave</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{summary.leave}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Daily Roster */}
          <div>
            <h3 className="text-lg font-semibold mb-4">👥 Daily Roster</h3>
            <p className="text-sm text-muted-foreground mb-4">
              📅 Showing tasks completed by members on {format(selectedDate, 'MMMM dd, yyyy')}
            </p>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : filteredData && filteredData.length > 0 ? (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Work Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tasks Done</TableHead>
                        <TableHead>Total Tasks</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Hours Worked</TableHead>
                        <TableHead>Reporting Manager</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>{row.designation}</TableCell>
                          <TableCell>{row.work_role}</TableCell>
                          <TableCell>
                            <Badge variant={
                              row.status === 'PRESENT' ? 'default' :
                              row.status === 'LEAVE' ? 'secondary' : 'destructive'
                            }>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.tasks_done}</TableCell>
                          <TableCell>{row.total_tasks}</TableCell>
                          <TableCell>{row.clock_in}</TableCell>
                          <TableCell>{row.clock_out}</TableCell>
                          <TableCell>{row.hours_worked}</TableCell>
                          <TableCell>{row.reporting_manager}</TableCell>
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
      )}

      {selectedProject === 'All' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project to view detailed allocation information.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Project Dialog Content Component
const ProjectDialogContent = ({ type, data, userNameMapping, selectedDate }) => {
  if (!data) return null;

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
        <TableHeader>
          <TableRow>
            <TableHead>User Name</TableHead>
            <TableHead>Tasks Completed</TableHead>
            <TableHead>Hours Worked</TableHead>
            <TableHead>Work Role</TableHead>
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
        <TableHeader>
          <TableRow>
            <TableHead>User Name</TableHead>
            <TableHead>Hours Worked</TableHead>
            <TableHead>Tasks Completed</TableHead>
            <TableHead>Work Role</TableHead>
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
        <TableHeader>
          <TableRow>
            <TableHead>User Name</TableHead>
            <TableHead>Work Role</TableHead>
            <TableHead>Hours Worked</TableHead>
            <TableHead>Tasks Completed</TableHead>
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
    const userAdminResources = resources.filter(r => 
      ['USER', 'ADMIN'].includes((r.designation || '').toUpperCase())
    );

    const userList = userAdminResources.map(r => {
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
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Work Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total Hours</TableHead>
            <TableHead>Total Tasks</TableHead>
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
                <Badge variant={
                  item.attendance_status === 'PRESENT' ? 'default' :
                  item.attendance_status === 'LEAVE' ? 'secondary' : 'destructive'
                }>
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
