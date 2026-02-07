import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart, Area, AreaChart, Scatter, ScatterChart, ZAxis, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import {
  fetchProjectProductivityData,
  getUserRole,
  getToken,
} from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { 
  RefreshCw, 
  X, 
  Download, 
  Filter, 
  Settings, 
  Info, 
  AlertCircle, 
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  Target,
  BarChart3,
  FileText,
  Calendar as CalendarIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { LoaderThree } from '@/components/ui/loader';
import { HoverEffect } from '@/components/ui/card-hover-effect';

const ProjectProductivityDashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState('All Projects');
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const firstDay = startOfMonth(new Date());
    return firstDay;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [filterRoles, setFilterRoles] = useState([]);
  const [filterProjects, setFilterProjects] = useState([]);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Check if token exists on mount
  useEffect(() => {
    const existingToken = getToken();
    if (existingToken) {
      setTokenSet(true);
      setTokenInput(existingToken);
    }
  }, []);

  // Fetch data when token is set
  useEffect(() => {
    if (!tokenSet) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔄 Starting to fetch data...');
        const fetchedData = await fetchProjectProductivityData();
        console.log('✅ Data fetched successfully:', fetchedData.length, 'records');
        setData(fetchedData);
      } catch (err) {
        console.error('❌ Error loading data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tokenSet]);

  const handleSetToken = () => {
    if (tokenInput.trim()) {
      const token = tokenInput.trim();
      localStorage.setItem('token', token);
      localStorage.setItem('userRole', 'ADMIN');
      setTokenSet(true);
      console.log('✅ Token set successfully');
      console.log('💡 Token format check:', {
        startsWithBearer: token.startsWith('Bearer '),
        length: token.length,
        firstChars: token.substring(0, 30),
      });
      
      // If token doesn't start with "Bearer ", warn the user
      if (token.startsWith('Bearer ')) {
        console.warn('⚠️ Token includes "Bearer " prefix. Removing it...');
        const cleanToken = token.replace(/^Bearer\s+/i, '');
        localStorage.setItem('token', cleanToken);
        console.log('✅ Cleaned token stored');
      }
    }
  };

  const handleRefreshData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Manually refreshing data...');
      const fetchedData = await fetchProjectProductivityData();
      console.log('✅ Data refreshed:', fetchedData.length, 'records');
      setData(fetchedData);
    } catch (err) {
      console.error('❌ Error refreshing data:', err);
      setError(err.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  // Process and filter data
  const processedData = useMemo(() => {
    let filtered = [...data];

    filtered = filtered.map((row) => ({
      ...row,
      date: new Date(row.date),
    }));

    if (viewMode === 'Specific Project' && selectedProject) {
      filtered = filtered.filter((row) => row.project === selectedProject);
    }

    if (filtersApplied) {
      if (filterRoles.length > 0) {
        filtered = filtered.filter((row) => filterRoles.includes(row.role));
      }
      if (viewMode === 'All Projects' && filterProjects.length > 0) {
        filtered = filtered.filter((row) => filterProjects.includes(row.project));
      }
      if (startDate && endDate) {
        filtered = filtered.filter((row) => {
          const rowDate = new Date(row.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          rowDate.setHours(0, 0, 0, 0);
          return rowDate >= start && rowDate <= end;
        });
      }
    } else {
      if (startDate && endDate) {
        filtered = filtered.filter((row) => {
          const rowDate = new Date(row.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          rowDate.setHours(0, 0, 0, 0);
          return rowDate >= start && rowDate <= end;
        });
      }
    }

    return filtered;
  }, [data, viewMode, selectedProject, filtersApplied, filterRoles, filterProjects, startDate, endDate]);

  const uniqueProjects = useMemo(() => {
    return [...new Set(data.map((row) => row.project))].sort();
  }, [data]);

  const uniqueRoles = useMemo(() => {
    return [...new Set(data.map((row) => row.role))].sort();
  }, [data]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalHours = processedData.reduce((sum, row) => sum + (row.hours_worked || 0), 0);
    const totalTasks = processedData.reduce((sum, row) => sum + (row.tasks_completed || 0), 0);
    const avgProductivity =
      processedData.length > 0
        ? processedData.reduce((sum, row) => sum + (row.productivity_score || 0), 0) / processedData.length
        : 0;

    const dates = [...new Set(processedData.map((row) => row.date.getTime()))];
    const avgActiveUsers =
      dates.length > 0
        ? dates.reduce((sum, date) => {
            const rowsForDate = processedData.filter((row) => row.date.getTime() === date);
            const uniqueUsers = new Set(rowsForDate.map((row) => row.user_id));
            return sum + uniqueUsers.size;
          }, 0) / dates.length
        : 0;

    const assessedWithScores = processedData.filter(
      (row) => row.quality_rating !== 'Not Assessed' && row.quality_score != null
    );
    const avgQualityScore =
      assessedWithScores.length > 0
        ? assessedWithScores.reduce((sum, row) => sum + (row.quality_score || 0), 0) / assessedWithScores.length
        : null;

    const accuracyData = processedData.filter((row) => row.accuracy != null);
    const avgAccuracy =
      accuracyData.length > 0
        ? accuracyData.reduce((sum, row) => sum + (row.accuracy || 0), 0) / accuracyData.length
        : null;

    const criticalData = processedData.filter((row) => row.critical_rate != null);
    const avgCritical =
      criticalData.length > 0
        ? criticalData.reduce((sum, row) => sum + (row.critical_rate || 0), 0) / criticalData.length
        : null;

    const numProjects = viewMode === 'All Projects' ? uniqueProjects.length : 1;

    return {
      totalHours,
      totalTasks,
      avgProductivity,
      avgActiveUsers,
      numProjects,
      avgQualityScore,
      avgAccuracy,
      avgCritical,
    };
  }, [processedData, viewMode, uniqueProjects.length]);

  // Transform KPIs into HoverEffect items format
  const kpiItems = useMemo(() => {
    const items = [
      {
        id: 'total-hours',
        title: 'Total Hours',
        value: `${kpis.totalHours.toFixed(1)} hrs`,
        icon: <Clock className="h-4 w-4" />,
        description: 'Total hours worked',
        calculationDescription: 'Sum of all hours_worked values across all data records',
      },
      {
        id: 'total-tasks',
        title: 'Total Tasks',
        value: Math.round(kpis.totalTasks).toString(),
        icon: <Target className="h-4 w-4" />,
        description: 'Tasks completed',
        calculationDescription: 'Sum of all tasks_completed values across all data records',
      },
      {
        id: 'avg-productivity',
        title: 'Avg Productivity',
        value: `${kpis.avgProductivity.toFixed(1)}%`,
        icon: <TrendingUp className="h-4 w-4" />,
        description: 'Average productivity score',
        calculationDescription: 'Average of all productivity_score values (sum divided by total number of records)',
      },
      {
        id: 'avg-active-users',
        title: 'Avg Active Users',
        value: kpis.avgActiveUsers.toFixed(1),
        icon: <Users className="h-4 w-4" />,
        description: 'Average active users per day',
        calculationDescription: 'For each unique date, count the number of unique users, then calculate the average across all dates',
      },
    ];

    // Add conditional items based on view mode
    if (viewMode === 'All Projects') {
      items.push({
        id: 'active-projects',
        title: 'Active Projects',
        value: kpis.numProjects.toString(),
        icon: <FileText className="h-4 w-4" />,
        description: 'Number of active projects',
        calculationDescription: 'Count of unique projects in the dataset',
      });
    } else {
      items.push({
        id: 'avg-quality-score',
        title: 'Avg Quality Score',
        value: kpis.avgQualityScore != null ? kpis.avgQualityScore.toFixed(1) : 'N/A',
        icon: <BarChart3 className="h-4 w-4" />,
        description: 'Average quality score',
        calculationDescription: 'Average of quality_score values, only including records where quality_rating is not \'Not Assessed\' and quality_score is not null',
      });
    }

    items.push(
      {
        id: 'avg-accuracy',
        title: 'Avg Accuracy',
        value: kpis.avgAccuracy != null ? `${kpis.avgAccuracy.toFixed(1)}%` : 'N/A',
        icon: <Target className="h-4 w-4" />,
        description: 'Average accuracy',
        calculationDescription: 'Average of all accuracy values where accuracy is not null (sum divided by count of non-null records)',
      },
      {
        id: 'avg-critical-rate',
        title: 'Avg Critical Rate',
        value: kpis.avgCritical != null ? `${kpis.avgCritical.toFixed(1)}%` : 'N/A',
        icon: <AlertCircle className="h-4 w-4" />,
        description: 'Average critical rate',
        calculationDescription: 'Average of all critical_rate values where critical_rate is not null (sum divided by count of non-null records)',
      }
    );

    return items;
  }, [kpis, viewMode]);

  // Prepare chart data - transform to array format for recharts
  const chartData = useMemo(() => {
    // Get all unique dates
    const allDates = [...new Set(processedData.map((row) => format(row.date, 'yyyy-MM-dd')))].sort();
    const allProjects = [...new Set(processedData.map((row) => row.project))].sort().filter(Boolean);
    
    // If no projects, return empty data structures
    if (allProjects.length === 0 || processedData.length === 0) {
      return {
        hoursData: [],
        tasksData: [],
        productivityData: [],
        activeUsersData: [],
        accuracyData: [],
        criticalData: [],
        cumulativeData: [],
        monthlyData: [],
        allProjects: [],
      };
    }

    // Hours by project - group by date and project, sum hours
    const hoursData = allDates.map((date) => {
      const row = { date };
      allProjects.forEach((project) => {
        const projectData = processedData.filter(
          (r) => format(r.date, 'yyyy-MM-dd') === date && r.project === project
        );
        row[project] = projectData.reduce((sum, r) => sum + (r.hours_worked || 0), 0);
      });
      return row;
    });

    // Tasks by project - group by date and project, sum tasks
    const tasksData = allDates.map((date) => {
      const row = { date };
      allProjects.forEach((project) => {
        const projectData = processedData.filter(
          (r) => format(r.date, 'yyyy-MM-dd') === date && r.project === project
        );
        row[project] = projectData.reduce((sum, r) => sum + (r.tasks_completed || 0), 0);
      });
      return row;
    });

    // Productivity by project - group by date and project, average productivity
    const productivityData = allDates.map((date) => {
      const row = { date };
      allProjects.forEach((project) => {
        const projectData = processedData.filter(
          (r) => format(r.date, 'yyyy-MM-dd') === date && r.project === project
        );
        if (projectData.length > 0) {
          const avg = projectData.reduce((sum, r) => sum + (r.productivity_score || 0), 0) / projectData.length;
          row[project] = avg;
        } else {
          row[project] = 0;
        }
      });
      return row;
    });

    // Active users by date - count unique users per date
    const activeUsersData = allDates.map((date) => {
      const dateData = processedData.filter((r) => format(r.date, 'yyyy-MM-dd') === date);
      const uniqueUsers = new Set(dateData.map((r) => r.user_id));
      return { date, activeUsers: uniqueUsers.size };
    });

    // Accuracy by project
    const accuracyData = allDates.map((date) => {
      const row = { date };
      allProjects.forEach((project) => {
        const projectData = processedData.filter(
          (r) => format(r.date, 'yyyy-MM-dd') === date && r.project === project && r.accuracy != null
        );
        if (projectData.length > 0) {
          const avg = projectData.reduce((sum, r) => sum + (r.accuracy || 0), 0) / projectData.length;
          row[project] = avg;
        }
      });
      return row;
    }).filter((row) => Object.keys(row).length > 1); // Remove rows with only date

    // Critical rate by project
    const criticalData = allDates.map((date) => {
      const row = { date };
      allProjects.forEach((project) => {
        const projectData = processedData.filter(
          (r) => format(r.date, 'yyyy-MM-dd') === date && r.project === project && r.critical_rate != null
        );
        if (projectData.length > 0) {
          const avg = projectData.reduce((sum, r) => sum + (r.critical_rate || 0), 0) / projectData.length;
          row[project] = avg;
        }
      });
      return row;
    }).filter((row) => Object.keys(row).length > 1);

    // Cumulative data
    let cumulativeTasks = 0;
    let cumulativeHours = 0;
    const cumulativeData = allDates.map((date) => {
      const dateData = processedData.filter((r) => format(r.date, 'yyyy-MM-dd') === date);
      cumulativeTasks += dateData.reduce((sum, r) => sum + (r.tasks_completed || 0), 0);
      cumulativeHours += dateData.reduce((sum, r) => sum + (r.hours_worked || 0), 0);
      return { date, cumulativeTasks, cumulativeHours };
    });

    // Monthly heatmap data
    const monthlyData = [];
    const months = [...new Set(processedData.map((row) => format(row.date, 'yyyy-MM')))].sort();
    months.forEach((month) => {
      const row = { month };
      allProjects.forEach((project) => {
        const projectData = processedData.filter(
          (r) => format(r.date, 'yyyy-MM') === month && r.project === project
        );
        row[project] = projectData.reduce((sum, r) => sum + (r.tasks_completed || 0), 0);
      });
      monthlyData.push(row);
    });

    // Tasks by role - for radar chart
    const roles = [...new Set(processedData.map((row) => row.role))].sort().filter(Boolean);
    const tasksByRole = roles.map((role) => {
      const roleData = processedData.filter((r) => r.role === role);
      const totalTasks = roleData.reduce((sum, r) => sum + (r.tasks_completed || 0), 0);
      return {
        role,
        tasks: totalTasks,
        fullMark: Math.max(...roles.map((r) => {
          const rd = processedData.filter((row) => row.role === r);
          return rd.reduce((sum, row) => sum + (row.tasks_completed || 0), 0);
        }), 100), // Max value for scaling
      };
    });

    return {
      hoursData,
      tasksData,
      productivityData,
      activeUsersData,
      accuracyData,
      criticalData,
      cumulativeData,
      monthlyData,
      tasksByRole,
      allProjects,
    };
  }, [processedData, viewMode]);

  const handleApplyFilters = () => {
    setFiltersApplied(true);
  };

  const handleDownloadCSV = () => {
    const headers = [
      'date',
      'project',
      'user',
      'email',
      'role',
      'hours_worked',
      'tasks_completed',
      'quality_rating',
      'quality_score',
      'accuracy',
      'critical_rate',
      'productivity_score',
      'active_users',
    ];

    const csvRows = [
      headers.join(','),
      ...processedData.map((row) =>
        headers
          .map((header) => {
            let value = row[header];
            if (value === null || value === undefined) value = '';
            if (header === 'date') value = format(row.date, 'yyyy-MM-dd');
            if (typeof value === 'string' && value.includes(',')) value = `"${value}"`;
            return value;
          })
          .join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_productivity_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Token input UI
  if (!tokenSet) {
    return (
      <div className="min-h-screen w-full bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              Please paste your authentication token from the other page to access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Authentication Token</Label>
              <Textarea
                id="token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your token here..."
                className="font-mono text-sm"
                rows={4}
              />
            </div>
            <Button
              onClick={handleSetToken}
              disabled={!tokenInput.trim()}
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Set Token & Load Dashboard
            </Button>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Tip: Copy the token from your browser's localStorage or from the other page where you're logged in.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-center min-h-[200px]">
              <LoaderThree />
            </div>
            <div className="space-y-2 text-center">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
            </div>
            <Progress value={33} className="w-full" />
            <p className="text-center text-muted-foreground">Loading data from API...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-background p-6 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <div className="min-h-screen w-full bg-background p-6">
        <div className="w-full space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Data Available</AlertTitle>
            <AlertDescription>
              Please ensure metrics are calculated. Check the browser console (F12) to see if API calls are being made.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background p-6">
      <div className="w-full space-y-6">
        {/* View Mode & Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>View Mode & Filters</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshData}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* View Mode Selection */}
            <div className="flex items-center gap-4">
              <Label>View Mode:</Label>
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Projects">All Projects</SelectItem>
                  <SelectItem value="Specific Project">Specific Project</SelectItem>
                </SelectContent>
              </Select>
              {viewMode === 'Specific Project' && (
                <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueProjects.map((project) => (
                      <SelectItem key={project} value={project}>
                        {project}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="border-t pt-4 space-y-4">
                {/* Date Range - Full Width */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP') : 'Start Date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground text-sm">to</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP') : 'End Date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Role and Project Filters - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Role Filter */}
                  <div className="space-y-2">
                    <Label>Filter by Role</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      <div className="space-y-2">
                        {uniqueRoles.map((role) => (
                          <div key={role} className="flex items-center space-x-2">
                            <Checkbox
                              id={`role-${role}`}
                              checked={filterRoles.includes(role)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilterRoles([...filterRoles, role]);
                                } else {
                                  setFilterRoles(filterRoles.filter((r) => r !== role));
                                }
                              }}
                            />
                            <Label
                              htmlFor={`role-${role}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {role}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Project Filter (only for All Projects view) */}
                  {viewMode === 'All Projects' && (
                    <div className="space-y-2">
                      <Label>Filter by Project</Label>
                      <ScrollArea className="h-32 border rounded-md p-2">
                        <div className="space-y-2">
                          {uniqueProjects.map((project) => (
                            <div key={project} className="flex items-center space-x-2">
                              <Checkbox
                                id={`project-${project}`}
                                checked={filterProjects.includes(project)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilterProjects([...filterProjects, project]);
                                  } else {
                                    setFilterProjects(filterProjects.filter((p) => p !== project));
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`project-${project}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {project}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>

                {/* Filter Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    {filtersApplied && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Filters Applied
                      </Badge>
                    )}
                    {(filterRoles.length > 0 || filterProjects.length > 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilterRoles([]);
                          setFilterProjects([]);
                          setFiltersApplied(false);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                  <Button onClick={handleApplyFilters} size="sm">
                    Apply Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI Cards with HoverEffect */}
        <HoverEffect items={kpiItems} />

        {/* Charts in Tabs */}
        <Tabs defaultValue="productivity" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="productivity">Productivity</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          </TabsList>

          <TabsContent value="productivity" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Hours Worked Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <HoursChart data={chartData.hoursData} projects={chartData.allProjects} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Tasks Completed Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <TasksChart data={chartData.tasksData} projects={chartData.allProjects} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Average Productivity Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProductivityChart data={chartData.productivityData} projects={chartData.allProjects} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Active Users Count Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActiveUsersChart data={chartData.activeUsersData} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Accuracy Trend Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.accuracyData.length > 0 ? (
                    <AccuracyChart data={chartData.accuracyData} projects={chartData.allProjects} />
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No accuracy data available. Accuracy must be assessed in quality ratings.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Critical Rate Trend Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.criticalData.length > 0 ? (
                    <CriticalRateChart data={chartData.criticalData} projects={chartData.allProjects} />
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No critical rate data available. Critical rate must be assessed in quality ratings.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Accuracy vs Critical Rate Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  {processedData.filter((row) => row.accuracy != null && row.critical_rate != null).length > 0 ? (
                    <AccuracyCriticalScatter data={processedData} />
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No data available for accuracy vs critical rate analysis. Both metrics need to be assessed.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cumulative" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cumulative Tasks vs Hours Worked</CardTitle>
              </CardHeader>
              <CardContent>
                <CumulativeChart data={chartData.cumulativeData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="heatmap" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Summary - Heatmap</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonthlyHeatmap data={chartData.monthlyData} projects={chartData.allProjects} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Tasks Completed by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <TasksByRoleRadarChart data={chartData.tasksByRole} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Data Table in Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="data-table">
            <AccordionTrigger className="text-lg font-semibold">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                View Raw Data Table
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Raw Data</CardTitle>
                    <Button onClick={handleDownloadCSV} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Tasks</TableHead>
                          <TableHead>Quality Rating</TableHead>
                          <TableHead>Quality Score</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead>Critical Rate</TableHead>
                          <TableHead>Productivity</TableHead>
                          <TableHead>Active Users</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData
                          .sort((a, b) => b.date - a.date)
                          .slice(0, 100)
                          .map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{format(row.date, 'yyyy-MM-dd')}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{row.project}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {row.user.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  {row.user}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{row.role}</Badge>
                              </TableCell>
                              <TableCell>{row.hours_worked.toFixed(1)}</TableCell>
                              <TableCell>{row.tasks_completed}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    row.quality_rating === 'Good'
                                      ? 'default'
                                      : row.quality_rating === 'Average'
                                      ? 'secondary'
                                      : 'destructive'
                                  }
                                >
                                  {row.quality_rating}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {row.quality_score != null ? row.quality_score.toFixed(1) : 'N/A'}
                              </TableCell>
                              <TableCell>
                                {row.accuracy != null ? `${row.accuracy.toFixed(1)}%` : 'N/A'}
                              </TableCell>
                              <TableCell>
                                {row.critical_rate != null ? `${row.critical_rate.toFixed(1)}%` : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={row.productivity_score} className="w-16" />
                                  <span className="text-sm">{row.productivity_score.toFixed(1)}</span>
                                </div>
                              </TableCell>
                              <TableCell>{row.active_users}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Metrics Note</strong>: Accuracy and Critical Rate are part of quality assessments. 'N/A'
                      means these metrics haven't been assessed for that day.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

// Helper Components
const TokenStatusCard = ({ tokenSet, setTokenSet, setTokenInput, setData, onRefresh, loading }) => {
  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Token Set
            </Badge>
            <span className="text-sm text-muted-foreground font-mono">
              {getToken()?.substring(0, 20)}...
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open browser console (F12) to see API calls</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <Button onClick={onRefresh} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('userRole');
                setTokenSet(false);
                setTokenInput('');
                setData([]);
              }}
              variant="destructive"
              size="sm"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Token
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const KPICard = ({ title, value, icon, description, calculationDescription }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-muted-foreground cursor-help">{icon}</div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs space-y-2">
                <p className="font-semibold">{description || title}</p>
                {calculationDescription && (
                  <p className="text-xs text-muted-foreground">{calculationDescription}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
};

// Helper function to get chart colors - using actual computed values
const getChartColor = (index) => {
  // Dark theme chart colors from index.css
  const colors = [
    'oklch(0.488 0.243 264.376)', // chart-1 - purple/blue
    'oklch(0.696 0.17 162.48)',    // chart-2 - teal/green  
    'oklch(0.769 0.188 70.08)',    // chart-3 - yellow/orange
    'oklch(0.627 0.265 303.9)',    // chart-4 - pink/magenta
    'oklch(0.645 0.246 16.439)',   // chart-5 - orange/red
  ];
  return colors[(index - 1) % 5];
};

// Chart Components using recharts
// Scrollable chart wrapper (scrollbar hidden but scrolling enabled)
const ScrollableChart = ({ children, dataLength = 0 }) => {
  const minWidth = Math.max(800, dataLength * 60); // 60px per data point, minimum 800px
  return (
    <div className="w-full overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={{ minWidth: `${minWidth}px` }}>
        {children}
      </div>
    </div>
  );
};

const HoursChart = ({ data, projects = [] }) => {
  if (!data || data.length === 0 || !projects || projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = projects.reduce((acc, project, idx) => {
    acc[project] = {
      label: project,
      color: getChartColor((idx % 5) + 1),
    };
    return acc;
  }, { date: { label: 'Date' } });

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <AreaChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDataOverflow={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value).toLocaleDateString()} />}
          />
          {projects.map((project, idx) => {
            const color = getChartColor((idx % 5) + 1);
            return (
              <Area
                key={project}
                type="monotone"
                dataKey={project}
                stackId="1"
                stroke={color}
                fill={color}
                fillOpacity={0.6}
              />
            );
          })}
        </AreaChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const TasksChart = ({ data, projects = [] }) => {
  if (!data || data.length === 0 || !projects || projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = projects.reduce((acc, project, idx) => {
    acc[project] = {
      label: project,
      color: getChartColor((idx % 5) + 1),
    };
    return acc;
  }, { date: { label: 'Date' } });

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <LineChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDataOverflow={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value).toLocaleDateString()} />}
          />
          {projects.map((project, idx) => {
            const color = getChartColor((idx % 5) + 1);
            return (
              <Line
                key={project}
                type="monotone"
                dataKey={project}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const ProductivityChart = ({ data, projects = [] }) => {
  // Debug logging
  console.log('ProductivityChart - data:', data?.length, 'projects:', projects?.length);
  
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <div className="text-center">
          <p>No productivity data available</p>
          <p className="text-xs mt-2">Data points: {data?.length || 0}</p>
        </div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <div className="text-center">
          <p>No projects found</p>
          <p className="text-xs mt-2">Please ensure project data is loaded</p>
        </div>
      </div>
    );
  }

  const chartConfig = projects.reduce((acc, project, idx) => {
    acc[project] = {
      label: project,
      color: getChartColor((idx % 5) + 1),
    };
    return acc;
  }, { date: { label: 'Date' } });

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <LineChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDataOverflow={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value).toLocaleDateString()} />}
          />
          {projects.map((project, idx) => {
            const color = getChartColor((idx % 5) + 1);
            return (
              <Line
                key={project}
                type="monotone"
                dataKey={project}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const ActiveUsersChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = {
    date: { label: 'Date' },
    activeUsers: {
      label: 'Active Users',
      color: getChartColor(1),
    },
  };

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <BarChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDataOverflow={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value).toLocaleDateString()} />}
          />
          <Bar dataKey="activeUsers" fill={getChartColor(1)} radius={4} />
        </BarChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const AccuracyChart = ({ data, projects = [] }) => {
  if (!data || data.length === 0 || !projects || projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = projects.reduce((acc, project, idx) => {
    acc[project] = {
      label: project,
      color: getChartColor((idx % 5) + 1),
    };
    return acc;
  }, { date: { label: 'Date' } });

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <LineChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDataOverflow={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value).toLocaleDateString()} />}
          />
          {projects.map((project, idx) => {
            const color = getChartColor((idx % 5) + 1);
            return (
              <Line
                key={project}
                type="monotone"
                dataKey={project}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const CriticalRateChart = ({ data, projects = [] }) => {
  if (!data || data.length === 0 || !projects || projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = projects.reduce((acc, project, idx) => {
    acc[project] = {
      label: project,
      color: getChartColor((idx % 5) + 1),
    };
    return acc;
  }, { date: { label: 'Date' } });

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <LineChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDataOverflow={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value).toLocaleDateString()} />}
          />
          {projects.map((project, idx) => {
            const color = getChartColor((idx % 5) + 1);
            return (
              <Line
                key={project}
                type="monotone"
                dataKey={project}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const AccuracyCriticalScatter = ({ data }) => {
  const scatterData = data
    .filter((row) => row.accuracy != null && row.critical_rate != null)
    .map((row) => ({
      accuracy: row.accuracy,
      criticalRate: row.critical_rate,
      tasks: row.tasks_completed || 1,
      user: row.user,
      date: format(row.date, 'yyyy-MM-dd'),
      project: row.project,
    }));

  const chartConfig = {
    accuracy: { label: 'Accuracy (%)', color: getChartColor(1) },
    criticalRate: { label: 'Critical Rate (%)', color: getChartColor(2) },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[500px] w-full">
      <ScatterChart data={scatterData} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          type="number"
          dataKey="accuracy"
          name="Accuracy"
          unit="%"
          allowDataOverflow={false}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="number"
          dataKey="criticalRate"
          name="Critical Rate"
          unit="%"
          allowDataOverflow={false}
          tickLine={false}
          axisLine={false}
        />
        <ZAxis type="number" dataKey="tasks" range={[5, 30]} />
        <ChartTooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">User</span>
                      <span className="font-bold text-muted-foreground">{data.user}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">Date</span>
                      <span className="font-bold text-muted-foreground">{data.date}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">Accuracy</span>
                      <span className="font-bold">{data.accuracy}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">Critical Rate</span>
                      <span className="font-bold">{data.criticalRate}%</span>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Scatter dataKey="criticalRate" fill={getChartColor(1)}>
          {scatterData.map((entry, index) => {
            // Get project index to maintain consistent colors
            const projects = [...new Set(scatterData.map(d => d.project))];
            const projectIndex = projects.indexOf(entry.project);
            const color = projectIndex >= 0 ? getChartColor((projectIndex % 5) + 1) : getChartColor((index % 5) + 1);
            return <Cell key={`cell-${index}`} fill={color} />;
          })}
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
};

const CumulativeChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const tasksColor = getChartColor(1);
  const hoursColor = getChartColor(2);

  const chartConfig = {
    date: { label: 'Date' },
    cumulativeTasks: {
      label: 'Cumulative Tasks',
      color: tasksColor,
    },
    cumulativeHours: {
      label: 'Cumulative Hours',
      color: hoursColor,
    },
  };

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <LineChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDataOverflow={false}
            label={{ value: 'Cumulative Tasks', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDataOverflow={false}
            label={{ value: 'Cumulative Hours', angle: 90, position: 'insideRight' }}
          />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value).toLocaleDateString()} />}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="cumulativeTasks"
            stroke={tasksColor}
            strokeWidth={3}
            dot={false}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="cumulativeHours"
            stroke={hoursColor}
            fill={hoursColor}
            fillOpacity={0.5}
          />
        </LineChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const MonthlyHeatmap = ({ data, projects = [] }) => {
  if (!data || data.length === 0 || !projects || projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = projects.reduce((acc, project, idx) => {
    acc[project] = {
      label: project,
      color: getChartColor((idx % 5) + 1),
    };
    return acc;
  }, { month: { label: 'Month' } });

  return (
    <ScrollableChart dataLength={data.length}>
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <BarChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDataOverflow={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {projects.map((project, idx) => {
            const color = getChartColor((idx % 5) + 1);
            return (
              <Bar key={project} dataKey={project} stackId="1" fill={color} radius={4} />
            );
          })}
        </BarChart>
      </ChartContainer>
    </ScrollableChart>
  );
};

const TasksByRoleRadarChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = {
    tasks: {
      label: 'Tasks Completed',
      color: 'var(--chart-1)',
    },
  };

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[600px]"
    >
      <RadarChart data={data} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <PolarAngleAxis 
          dataKey="role" 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => value}
        />
        <PolarGrid />
        <Radar
          dataKey="tasks"
          fill="var(--color-tasks)"
          fillOpacity={0.6}
          dot={{
            r: 4,
            fillOpacity: 1,
          }}
        />
      </RadarChart>
    </ChartContainer>
  );
};

export default ProjectProductivityDashboard;
