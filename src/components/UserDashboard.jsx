import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart, Area, AreaChart, Scatter, ScatterChart, ZAxis, Cell, Legend, ResponsiveContainer, ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import {
  fetchUserProductivityData,
  getUserNameMapping,
  getUserEmailMapping,
  getUserSoulIdMapping,
  getProjectNameMapping,
  getToken,
} from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
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
  Search,
} from 'lucide-react';
import { LoaderThree } from '@/components/ui/loader';
import { HoverEffect } from '@/components/ui/card-hover-effect';

const UserProductivityDashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState('All Users');
  const [selectedUser, setSelectedUser] = useState(null);
  const [soulIdSearch, setSoulIdSearch] = useState('');
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const firstDay = startOfMonth(new Date());
    return firstDay;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [filterRoles, setFilterRoles] = useState([]);
  const [filterProjects, setFilterProjects] = useState([]);
  const [filterQuality, setFilterQuality] = useState(['Good', 'Average', 'Bad', 'Not Assessed']);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // User mappings
  const [userMap, setUserMap] = useState({});
  const [userEmailMap, setUserEmailMap] = useState({});
  const [soulIdMap, setSoulIdMap] = useState({});
  const [projectMap, setProjectMap] = useState({});

  // Check if token exists on mount
  useEffect(() => {
    const existingToken = getToken();
    if (existingToken) {
      setTokenSet(true);
      setTokenInput(existingToken);
    }
  }, []);

  // Load user mappings
  useEffect(() => {
    if (!tokenSet) return;

    const loadMappings = async () => {
      try {
        const [names, emails, soulIds, projects] = await Promise.all([
          getUserNameMapping(),
          getUserEmailMapping(),
          getUserSoulIdMapping(),
          getProjectNameMapping(),
        ]);
        setUserMap(names);
        setUserEmailMap(emails);
        setSoulIdMap(soulIds);
        setProjectMap(projects);
      } catch (err) {
        console.error('Error loading mappings:', err);
      }
    };

    loadMappings();
  }, [tokenSet]);

  // Fetch data when token is set
  useEffect(() => {
    if (!tokenSet) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔄 Starting to fetch user productivity data...');
        const fetchedData = await fetchUserProductivityData();
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
      if (token.startsWith('Bearer ')) {
        const cleanToken = token.replace(/^Bearer\s+/i, '');
        localStorage.setItem('token', cleanToken);
      }
    }
  };

  const handleRefreshData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Manually refreshing data...');
      const fetchedData = await fetchUserProductivityData();
      console.log('✅ Data refreshed:', fetchedData.length, 'records');
      setData(fetchedData);
    } catch (err) {
      console.error('❌ Error refreshing data:', err);
      setError(err.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  // Get unique users for dropdown
  const uniqueUsers = useMemo(() => {
    const users = [...new Set(data.map((row) => row.user))].sort();
    return users.map((userName) => {
      const userId = Object.keys(userMap).find((id) => userMap[id] === userName);
      const email = userId ? userEmailMap[userId] : '';
      const soulId = userId ? soulIdMap[userId] : '';
      
      let displayName = userName;
      if (email && soulId) {
        displayName = `${userName} (${email}) - Soul ID: ${soulId}`;
      } else if (email) {
        displayName = `${userName} (${email})`;
      } else if (soulId) {
        displayName = `${userName} (Soul ID: ${soulId})`;
      }
      
      return { userName, displayName };
    });
  }, [data, userMap, userEmailMap, soulIdMap]);

  // Process and filter data
  const processedData = useMemo(() => {
    let filtered = [...data];

    filtered = filtered.map((row) => ({
      ...row,
      date: new Date(row.date),
    }));

    // Apply view mode filter
    if (viewMode === 'Specific User' && selectedUser) {
      filtered = filtered.filter((row) => row.user === selectedUser);
    }

    // Apply soul ID search (only for All Users mode)
    if (viewMode === 'All Users' && soulIdSearch && soulIdSearch.trim()) {
      const searchTerm = soulIdSearch.trim().toLowerCase();
      const matchingUserIds = Object.keys(soulIdMap).filter(
        (userId) => soulIdMap[userId] && soulIdMap[userId].toLowerCase().includes(searchTerm)
      );
      const matchingUserNames = matchingUserIds.map((uid) => userMap[uid]).filter(Boolean);
      if (matchingUserNames.length > 0) {
        filtered = filtered.filter((row) => matchingUserNames.includes(row.user));
      } else {
        filtered = []; // No matches
      }
    }

    if (filtersApplied) {
      if (viewMode === 'All Users' && filterRoles.length > 0) {
        filtered = filtered.filter((row) => filterRoles.includes(row.role));
      }
      if (filterProjects.length > 0) {
        filtered = filtered.filter((row) => filterProjects.includes(row.project));
      }
      if (filterQuality.length > 0 && filterQuality.length < 4) {
        filtered = filtered.filter((row) => filterQuality.includes(row.quality_rating));
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
      // Default: apply date range
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
  }, [data, viewMode, selectedUser, soulIdSearch, filtersApplied, filterRoles, filterProjects, filterQuality, startDate, endDate, userMap, soulIdMap]);

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

    // Quality coverage
    const assessedCount = processedData.filter((row) => row.quality_rating !== 'Not Assessed').length;
    const qualityCoverage = processedData.length > 0 ? (assessedCount / processedData.length) * 100 : 0;

    // Active users (only for All Users mode)
    const uniqueUsersCount = viewMode === 'All Users' 
      ? [...new Set(processedData.map((row) => row.user_id))].length 
      : 0;

    // Average quality score (only for Specific User mode)
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

    return {
      totalHours,
      totalTasks,
      avgProductivity,
      qualityCoverage,
      uniqueUsersCount,
      avgQualityScore,
      avgAccuracy,
      avgCritical,
    };
  }, [processedData, viewMode]);

  // Transform KPIs into HoverEffect items format
  const kpiItems = useMemo(() => {
    const baseKpis = [
      {
        id: 'total-hours',
        title: 'Total Hours Worked',
        value: `${kpis.totalHours.toFixed(1)} hrs`,
        icon: <Clock className="h-4 w-4" />,
        description: 'Total hours worked',
        calculationDescription: 'Sum of all hours_worked values across all data records',
      },
      {
        id: 'total-tasks',
        title: 'Total Tasks Completed',
        value: Math.round(kpis.totalTasks).toString(),
        icon: <Target className="h-4 w-4" />,
        description: 'Tasks completed',
        calculationDescription: 'Sum of all tasks_completed values across all data records',
      },
      {
        id: 'avg-productivity',
        title: 'Avg Productivity Score',
        value: `${kpis.avgProductivity.toFixed(1)}%`,
        icon: <TrendingUp className="h-4 w-4" />,
        description: 'Average productivity score',
        calculationDescription: 'Average of all productivity_score values (sum divided by total number of records)',
      },
      {
        id: 'quality-coverage',
        title: 'Quality Coverage',
        value: `${kpis.qualityCoverage.toFixed(1)}%`,
        icon: <BarChart3 className="h-4 w-4" />,
        description: 'Percentage of records with quality assessments',
        calculationDescription: 'Number of records with quality_rating not equal to "Not Assessed" divided by total records, multiplied by 100',
      },
    ];

    if (viewMode === 'All Users') {
      baseKpis.push({
        id: 'active-users',
        title: 'Active Users',
        value: kpis.uniqueUsersCount.toString(),
        icon: <Users className="h-4 w-4" />,
        description: 'Number of unique users',
        calculationDescription: 'Count of unique user_id values in the dataset',
      });
    } else {
      baseKpis.push({
        id: 'avg-quality-score',
        title: 'Avg Quality Score',
        value: kpis.avgQualityScore != null ? kpis.avgQualityScore.toFixed(1) : 'N/A',
        icon: <BarChart3 className="h-4 w-4" />,
        description: 'Average quality score',
        calculationDescription: 'Average of quality_score values, only including records where quality_rating is not \'Not Assessed\' and quality_score is not null',
      });
    }

    baseKpis.push(
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

    return baseKpis;
  }, [kpis, viewMode]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const allDates = [...new Set(processedData.map((row) => format(row.date, 'yyyy-MM-dd')))].sort();
    const allUsers = [...new Set(processedData.map((row) => row.user))].sort();
    const allProjects = [...new Set(processedData.map((row) => row.project))].sort();

    if (processedData.length === 0) {
      return {
        hoursData: [],
        tasksData: [],
        productivityData: [],
        qualityDistributionData: [],
        attendanceData: [],
        qualityScoreData: [],
        accuracyData: [],
        criticalData: [],
        accuracyCriticalScatter: [],
        userQualityTrend: [],
        cumulativeData: [],
        allUsers: [],
        allProjects: [],
      };
    }

    // Hours by date
    const hoursData = allDates.map((date) => {
      const dateData = processedData.filter((r) => format(r.date, 'yyyy-MM-dd') === date);
      return {
        date,
        hours: dateData.reduce((sum, r) => sum + (r.hours_worked || 0), 0),
      };
    });

    // Tasks by date
    const tasksData = allDates.map((date) => {
      const dateData = processedData.filter((r) => format(r.date, 'yyyy-MM-dd') === date);
      return {
        date,
        tasks: dateData.reduce((sum, r) => sum + (r.tasks_completed || 0), 0),
      };
    });

    // Productivity by date (with moving average)
    const productivityData = allDates.map((date) => {
      const dateData = processedData.filter((r) => format(r.date, 'yyyy-MM-dd') === date);
      const avg = dateData.length > 0
        ? dateData.reduce((sum, r) => sum + (r.productivity_score || 0), 0) / dateData.length
        : 0;
      return { date, productivity: avg };
    });

    // Calculate 7-day moving average
    productivityData.forEach((row, idx) => {
      const window = productivityData.slice(Math.max(0, idx - 6), idx + 1);
      row.movingAvg = window.reduce((sum, r) => sum + r.productivity, 0) / window.length;
    });

    // Quality distribution
    const qualityCounts = {};
    processedData.forEach((row) => {
      const rating = row.quality_rating || 'Not Assessed';
      qualityCounts[rating] = (qualityCounts[rating] || 0) + 1;
    });
    const qualityDistributionData = [
      { rating: 'Good', count: qualityCounts['Good'] || 0 },
      { rating: 'Average', count: qualityCounts['Average'] || 0 },
      { rating: 'Bad', count: qualityCounts['Bad'] || 0 },
      { rating: 'Not Assessed', count: qualityCounts['Not Assessed'] || 0 },
    ];

    // Attendance by date and status
    const attendanceData = allDates.map((date) => {
      const dateData = processedData.filter((r) => format(r.date, 'yyyy-MM-dd') === date);
      const statusCounts = { Present: 0, WFH: 0, Leave: 0, Absent: 0 };
      dateData.forEach((row) => {
        const status = row.attendance_status || 'Absent';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });
      return { date, ...statusCounts };
    });

    // Quality score trend
    const assessedData = processedData.filter(
      (row) => row.quality_rating !== 'Not Assessed' && row.quality_score != null
    );
    const qualityScoreByDate = {};
    assessedData.forEach((row) => {
      const date = format(row.date, 'yyyy-MM-dd');
      if (!qualityScoreByDate[date]) {
        qualityScoreByDate[date] = [];
      }
      qualityScoreByDate[date].push(row.quality_score);
    });
    const qualityScoreData = Object.keys(qualityScoreByDate)
      .sort()
      .map((date) => {
        const scores = qualityScoreByDate[date];
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        return { date, score: avg };
      });

    // Calculate moving average for quality score
    qualityScoreData.forEach((row, idx) => {
      const window = qualityScoreData.slice(Math.max(0, idx - 6), idx + 1);
      row.movingAvg = window.reduce((sum, r) => sum + r.score, 0) / window.length;
    });

    // Accuracy trend
    const accuracyData = allDates.map((date) => {
      const dateData = processedData.filter(
        (r) => format(r.date, 'yyyy-MM-dd') === date && r.accuracy != null
      );
      if (dateData.length === 0) return null;
      const avg = dateData.reduce((sum, r) => sum + (r.accuracy || 0), 0) / dateData.length;
      return { date, accuracy: avg };
    }).filter(Boolean);

    // Critical rate trend
    const criticalData = allDates.map((date) => {
      const dateData = processedData.filter(
        (r) => format(r.date, 'yyyy-MM-dd') === date && r.critical_rate != null
      );
      if (dateData.length === 0) return null;
      const avg = dateData.reduce((sum, r) => sum + (r.critical_rate || 0), 0) / dateData.length;
      return { date, criticalRate: avg };
    }).filter(Boolean);

    // Accuracy vs Critical Rate scatter
    const accuracyCriticalScatter = processedData
      .filter((row) => row.accuracy != null && row.critical_rate != null)
      .map((row) => ({
        accuracy: row.accuracy,
        criticalRate: row.critical_rate,
        tasks: row.tasks_completed || 0,
        date: format(row.date, 'yyyy-MM-dd'),
        qualityRating: row.quality_rating,
        user: row.user,
      }));

    // User quality trend (for All Users mode)
    const userQualityTrend = [];
    if (viewMode === 'All Users') {
      allUsers.forEach((user) => {
        const userData = assessedData.filter((row) => row.user === user);
        const byDate = {};
        userData.forEach((row) => {
          const date = format(row.date, 'yyyy-MM-dd');
          if (!byDate[date]) {
            byDate[date] = [];
          }
          byDate[date].push(row.quality_score);
        });
        Object.keys(byDate).sort().forEach((date) => {
          const scores = byDate[date];
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          userQualityTrend.push({ date, user, score: avg });
        });
      });
    }

    // Cumulative data
    let cumulativeTasks = 0;
    let cumulativeHours = 0;
    const cumulativeData = allDates.map((date) => {
      const dateData = processedData.filter((r) => format(r.date, 'yyyy-MM-dd') === date);
      cumulativeTasks += dateData.reduce((sum, r) => sum + (r.tasks_completed || 0), 0);
      cumulativeHours += dateData.reduce((sum, r) => sum + (r.hours_worked || 0), 0);
      return { date, cumulativeTasks, cumulativeHours };
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
      qualityDistributionData,
      attendanceData,
      qualityScoreData,
      accuracyData,
      criticalData,
      accuracyCriticalScatter,
      userQualityTrend,
      cumulativeData,
      tasksByRole,
      allUsers,
      allProjects,
    };
  }, [processedData, viewMode]);

  const handleApplyFilters = () => {
    setFiltersApplied(true);
  };

  const handleDownloadCSV = () => {
    const headers = [
      'date',
      'user',
      'email',
      'project',
      'role',
      'hours_worked',
      'tasks_completed',
      'quality_rating',
      'quality_score',
      'quality_source',
      'accuracy',
      'critical_rate',
      'productivity_score',
      'attendance_status',
    ];

    const csvRows = [
      headers.join(','),
      ...processedData.map((row) =>
        headers
          .map((header) => {
            let value = row[header];
            if (value instanceof Date) {
              value = format(value, 'yyyy-MM-dd');
            } else if (value === null || value === undefined) {
              value = '';
            } else {
              value = String(value).replace(/"/g, '""');
            }
            return `"${value}"`;
          })
          .join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_productivity_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

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

  // Chart components
  const HoursChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDataOverflow={false} />
          <Area type="monotone" dataKey="hours" stroke="#1f77b4" fill="#1f77b4" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

  const TasksChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDataOverflow={false} />
          <Line type="monotone" dataKey="tasks" stroke="#ff7f0e" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

  const ProductivityChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDataOverflow={false} />
          <Line type="monotone" dataKey="productivity" stroke="#87ceeb" strokeWidth={1} dot={{ r: 3 }} opacity={0.5} name="Daily Score" />
          <Line type="monotone" dataKey="movingAvg" stroke="#2ca02c" strokeWidth={3} name="7-Day Moving Avg" />
          <Legend />
        </ComposedChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

  const QualityDistributionChart = ({ data }) => {
    const colors = { Good: '#2ca02c', Average: '#ff7f0e', Bad: '#d62728', 'Not Assessed': '#888888' };
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="rating" />
          <YAxis />
          <Bar dataKey="count" fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[entry.rating] || '#888888'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const AttendanceChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDataOverflow={false} />
          <Bar dataKey="Present" stackId="a" fill="#2ca02c" />
          <Bar dataKey="WFH" stackId="a" fill="#1f77b4" />
          <Bar dataKey="Leave" stackId="a" fill="#ff7f0e" />
          <Bar dataKey="Absent" stackId="a" fill="#d62728" />
          <Legend />
        </BarChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

  const QualityScoreChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDataOverflow={false} />
          <Line type="monotone" dataKey="score" stroke="#9467bd" strokeWidth={2} dot={{ r: 4 }} opacity={0.7} name="Daily Quality Score" />
          {data.length > 1 && (
            <Line type="monotone" dataKey="movingAvg" stroke="#2ca02c" strokeWidth={3} name="7-Day Moving Avg" />
          )}
          <Legend />
        </ComposedChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

  const AccuracyChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDataOverflow={false} />
          <Line type="monotone" dataKey="accuracy" stroke="#17becf" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

  const CriticalRateChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDataOverflow={false} />
          <Line type="monotone" dataKey="criticalRate" stroke="#e377c2" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

  const AccuracyCriticalScatter = ({ data }) => (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="accuracy" allowDataOverflow={false} name="Accuracy" />
        <YAxis type="number" dataKey="criticalRate" allowDataOverflow={false} name="Critical Rate" />
        <ZAxis type="number" dataKey="tasks" range={[50, 400]} name="Tasks" />
        <Scatter data={data} fill="#8884d8">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.qualityRating === 'Good' ? '#2ca02c' : entry.qualityRating === 'Average' ? '#ff7f0e' : '#d62728'} />
          ))}
        </Scatter>
        <Legend />
      </ScatterChart>
    </ResponsiveContainer>
  );

  const UserQualityTrendChart = ({ data }) => {
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    const users = [...new Set(data.map((d) => d.user))];
    const dates = [...new Set(data.map((d) => d.date))];
    
    return (
      <ScrollableChart dataLength={dates.length}>
        <ResponsiveContainer width="100%" height={500}>
          <LineChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDataOverflow={false} />
            {users.map((user, idx) => {
              const userData = data.filter((d) => d.user === user);
              return (
                <Line
                  key={user}
                  type="monotone"
                  data={userData}
                  dataKey="score"
                  name={user}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              );
            })}
            <Legend />
          </LineChart>
        </ResponsiveContainer>
      </ScrollableChart>
    );
  };

  const CumulativeChart = ({ data }) => (
    <ScrollableChart dataLength={data?.length || 0}>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" allowDataOverflow={false} />
          <YAxis yAxisId="right" orientation="right" allowDataOverflow={false} />
          <Line yAxisId="left" type="monotone" dataKey="cumulativeTasks" stroke="#1f77b4" strokeWidth={2} name="Cumulative Tasks" />
          <Line yAxisId="right" type="monotone" dataKey="cumulativeHours" stroke="#ff7f0e" strokeWidth={2} name="Cumulative Hours" />
          <Legend />
        </ComposedChart>
      </ResponsiveContainer>
    </ScrollableChart>
  );

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

  if (!tokenSet) {
    return (
      <div className="min-h-screen w-full bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Set API Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter your API token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSetToken();
                  }
                }}
              />
            </div>
            <Button onClick={handleSetToken} className="w-full">
              Set Token
            </Button>
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
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={handleRefreshData} className="mt-4 w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <div className="min-h-screen w-full bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No data available. Please ensure metrics are calculated.
              </AlertDescription>
            </Alert>
            <Button onClick={handleRefreshData} className="mt-4 w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background p-6">
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">User Productivity & Quality Dashboard</h1>
          <p className="text-muted-foreground text-lg">Comprehensive analytics for individual user performance tracking</p>
        </div>

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-4">
                <Label>View Mode:</Label>
                <Select value={viewMode} onValueChange={(value) => {
                  setViewMode(value);
                  if (value === 'All Users') {
                    setSelectedUser(null);
                  }
                }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Users">All Users</SelectItem>
                    <SelectItem value="Specific User">Specific User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {viewMode === 'Specific User' && (
                <div className="flex items-center gap-4">
                  <Label>Select User:</Label>
                  <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Select User" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueUsers.map((user) => (
                        <SelectItem key={user.userName} value={user.userName}>
                          {user.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {viewMode === 'All Users' && (
                <div className="flex items-center gap-4">
                  <Label htmlFor="soul-id-search">
                    <Search className="h-4 w-4 inline mr-2" />
                    Search by Soul ID:
                  </Label>
                  <Input
                    id="soul-id-search"
                    placeholder="Enter Soul ID..."
                    value={soulIdSearch}
                    onChange={(e) => setSoulIdSearch(e.target.value)}
                    className="w-[200px]"
                  />
                </div>
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
                    <span className="text-muted-foreground">to</span>
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

                {/* Role, Project, and Quality Filters - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Role Filter (only for All Users) */}
                  {viewMode === 'All Users' && (
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
                  )}

                  {/* Project Filter */}
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

                  {/* Quality Filter */}
                  <div className="space-y-2">
                    <Label>Filter by Quality</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      <div className="space-y-2">
                        {['Good', 'Average', 'Bad', 'Not Assessed'].map((quality) => (
                          <div key={quality} className="flex items-center space-x-2">
                            <Checkbox
                              id={`quality-${quality}`}
                              checked={filterQuality.includes(quality)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilterQuality([...filterQuality, quality]);
                                } else {
                                  setFilterQuality(filterQuality.filter((q) => q !== quality));
                                }
                              }}
                            />
                            <Label
                              htmlFor={`quality-${quality}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {quality}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
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
                    {(filterRoles.length > 0 || filterProjects.length > 0 || filterQuality.length < 4) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilterRoles([]);
                          setFilterProjects([]);
                          setFilterQuality(['Good', 'Average', 'Bad', 'Not Assessed']);
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
        <HoverEffect items={kpiItems} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />

        {/* Charts in Tabs */}
        <Tabs defaultValue="productivity" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="productivity">Productivity</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
          </TabsList>

          <TabsContent value="productivity" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Hours Worked Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <HoursChart data={chartData.hoursData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Tasks Completed Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <TasksChart data={chartData.tasksData} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Average Productivity Score Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProductivityChart data={chartData.productivityData} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quality Rating Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <QualityDistributionChart data={chartData.qualityDistributionData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Quality Score Trend (Manually Assessed)</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.qualityScoreData.length > 0 ? (
                    <QualityScoreChart data={chartData.qualityScoreData} />
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No quality assessments available. Quality ratings must be manually assessed to see trends.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Accuracy Trend Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.accuracyData.length > 0 ? (
                    <AccuracyChart data={chartData.accuracyData} />
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
                    <CriticalRateChart data={chartData.criticalData} />
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
                  <CardTitle>Accuracy vs Critical Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.accuracyCriticalScatter.length > 0 ? (
                    <AccuracyCriticalScatter data={chartData.accuracyCriticalScatter} />
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
              {viewMode === 'All Users' && chartData.userQualityTrend.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>User Quality Trend Chart</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UserQualityTrendChart data={chartData.userQualityTrend} />
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Status Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <AttendanceChart data={chartData.attendanceData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cumulative" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cumulative Tasks vs Hours Worked</CardTitle>
                </CardHeader>
                <CardContent>
                  <CumulativeChart data={chartData.cumulativeData} />
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
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Tasks</TableHead>
                          <TableHead>Quality Rating</TableHead>
                          <TableHead>Quality Score</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead>Critical Rate</TableHead>
                          <TableHead>Productivity</TableHead>
                          <TableHead>Attendance</TableHead>
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
                                <Badge variant="outline">{row.project}</Badge>
                              </TableCell>
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
                                      : row.quality_rating === 'Bad'
                                      ? 'destructive'
                                      : 'outline'
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
                              <TableCell>
                                <Badge
                                  variant={
                                    row.attendance_status === 'Present'
                                      ? 'default'
                                      : row.attendance_status === 'WFH'
                                      ? 'secondary'
                                      : row.attendance_status === 'Leave'
                                      ? 'outline'
                                      : 'destructive'
                                  }
                                >
                                  {row.attendance_status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Metrics Note</strong>: Quality, Accuracy, and Critical Rate are assessed manually. 'N/A' means these metrics haven't been assessed for that day.
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

export default UserProductivityDashboard;
