import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  getAllProjects,
  getAllUsers,
  getDailyRosterReport,
  getProjectHistoryReport,
  getUserPerformanceReport,
} from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Calendar as CalendarIcon,
  Download,
  Search,
  AlertCircle,
  Info,
  RefreshCw,
  FolderOpen,
  User,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LoaderThreeDemo } from './LoaderDemo';

const ReportsCenter = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Tab 1: Daily Roster states
  const [rosterProjectId, setRosterProjectId] = useState('all');
  const [rosterStartDate, setRosterStartDate] = useState(new Date());
  const [rosterEndDate, setRosterEndDate] = useState(new Date());
  const [rosterStartPickerOpen, setRosterStartPickerOpen] = useState(false);
  const [rosterEndPickerOpen, setRosterEndPickerOpen] = useState(false);
  const [rosterData, setRosterData] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  
  // Tab 2: Project History states
  const [historyProjectId, setHistoryProjectId] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [historyEndDate, setHistoryEndDate] = useState(new Date());
  const [historyStartPickerOpen, setHistoryStartPickerOpen] = useState(false);
  const [historyEndPickerOpen, setHistoryEndPickerOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Tab 3: User Performance states
  const [performanceUserId, setPerformanceUserId] = useState('');
  const [performanceStartDate, setPerformanceStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [performanceEndDate, setPerformanceEndDate] = useState(new Date());
  const [performanceStartPickerOpen, setPerformanceStartPickerOpen] = useState(false);
  const [performanceEndPickerOpen, setPerformanceEndPickerOpen] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

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
      const [projectsData, usersData] = await Promise.all([
        getAllProjects(),
        getAllUsers({ limit: 1000 }),
      ]);
      
      setProjects(projectsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('❌ Failed to load data', {
        description: error?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      await Promise.all([
        fetchAllData(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
      if (isMounted) {
        setInitialLoading(false);
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAllData();
      toast.success('✅ Data refreshed successfully', {
        description: 'All data has been reloaded.',
      });
    } catch (error) {
      toast.error('❌ Failed to refresh data', {
        description: 'Please try again later.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Parse CSV data
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      return row;
    });
    
    return { headers, rows };
  };

  // Tab 1: Preview Daily Roster
  const handlePreviewRoster = async () => {
    if (rosterStartDate > rosterEndDate) {
      toast.error('❌ Invalid date range', {
        description: "'From Date' cannot be after 'To Date'.",
      });
      return;
    }

    setRosterLoading(true);
    setRosterData(null);
    
    try {
      const params = {
        start_date: format(rosterStartDate, 'yyyy-MM-dd'),
        end_date: format(rosterEndDate, 'yyyy-MM-dd'),
      };
      
      if (rosterProjectId !== 'all') {
        params.project_id = rosterProjectId;
      }
      
      const blob = await getDailyRosterReport(params);
      const csvText = await blob.text();
      
      if (!csvText || csvText.trim() === '') {
        toast.warning('⚠️ No data available', {
          description: 'No roster data found for the selected date range and project.',
        });
        setRosterData(null);
        return;
      }
      
      const parsed = parseCSV(csvText);
      setRosterData({ csv: csvText, blob, parsed, params });
      
      toast.success('✅ Roster loaded successfully', {
        description: `Found ${parsed.rows.length} record(s).`,
      });
    } catch (error) {
      console.error('Error fetching roster:', error);
      const errorMessage = error?.message || 'Failed to fetch roster data. Please try again.';
      toast.error('❌ Failed to load roster', {
        description: errorMessage,
      });
      setRosterData(null);
    } finally {
      setRosterLoading(false);
    }
  };

  // Tab 1: Download Daily Roster
  const handleDownloadRoster = () => {
    if (!rosterData) return;
    
    try {
      const projectName = rosterProjectId === 'all' 
        ? 'All_Projects' 
        : projects.find(p => p.id === rosterProjectId)?.name || 'Project';
      const startDateStr = format(rosterStartDate, 'yyyy-MM-dd');
      const endDateStr = format(rosterEndDate, 'yyyy-MM-dd');
      const dateSuffix = startDateStr === endDateStr ? startDateStr : `${startDateStr}_to_${endDateStr}`;
      const fileName = `Roster_${projectName}_${dateSuffix}.csv`;
      
      const url = window.URL.createObjectURL(rosterData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('✅ CSV downloaded successfully', {
        description: `File: ${fileName}`,
      });
    } catch (error) {
      toast.error('❌ Failed to download CSV', {
        description: 'An error occurred while downloading the file.',
      });
    }
  };

  // Tab 2: Preview Project History
  const handlePreviewHistory = async () => {
    if (!historyProjectId) {
      toast.warning('⚠️ Missing required field', {
        description: 'Please select a project.',
      });
      return;
    }
    if (historyStartDate > historyEndDate) {
      toast.error('❌ Invalid date range', {
        description: "'From Date' cannot be after 'To Date'.",
      });
      return;
    }
    
    setHistoryLoading(true);
    setHistoryData(null);
    
    try {
      const blob = await getProjectHistoryReport(historyProjectId, {
        start_date: format(historyStartDate, 'yyyy-MM-dd'),
        end_date: format(historyEndDate, 'yyyy-MM-dd'),
      });
      const csvText = await blob.text();
      
      if (!csvText || csvText.trim() === '') {
        toast.warning('⚠️ No data available', {
          description: 'No history data found for this project.',
        });
        setHistoryData(null);
        return;
      }
      
      const parsed = parseCSV(csvText);
      setHistoryData({ csv: csvText, blob, parsed });
      
      toast.success('✅ Project history loaded successfully', {
        description: `Found ${parsed.rows.length} record(s).`,
      });
    } catch (error) {
      console.error('Error fetching project history:', error);
      const errorMessage = error?.message || 'Failed to fetch project history. Please try again.';
      toast.error('❌ Failed to load project history', {
        description: errorMessage,
      });
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Tab 2: Download Project History
  const handleDownloadHistory = () => {
    if (!historyData) return;
    
    try {
      const projectName = projects.find(p => p.id === historyProjectId)?.name || 'Project';
      const fileName = `History_${projectName}_${format(historyStartDate, 'yyyy-MM-dd')}_to_${format(historyEndDate, 'yyyy-MM-dd')}.csv`;
      
      const url = window.URL.createObjectURL(historyData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('✅ CSV downloaded successfully', {
        description: `File: ${fileName}`,
      });
    } catch (error) {
      toast.error('❌ Failed to download CSV', {
        description: 'An error occurred while downloading the file.',
      });
    }
  };

  // Tab 3: Preview User Performance
  const handlePreviewPerformance = async () => {
    if (!performanceUserId) {
      toast.warning('⚠️ Missing required field', {
        description: 'Please select a user.',
      });
      return;
    }
    if (performanceStartDate > performanceEndDate) {
      toast.error('❌ Invalid date range', {
        description: "'Start Date' cannot be after 'End Date'.",
      });
      return;
    }
    
    setPerformanceLoading(true);
    setPerformanceData(null);
    
    try {
      const params = {
        user_id: performanceUserId,
        start_date: format(performanceStartDate, 'yyyy-MM-dd'),
        end_date: format(performanceEndDate, 'yyyy-MM-dd'),
      };
      
      const blob = await getUserPerformanceReport(params);
      const csvText = await blob.text();
      
      if (!csvText || csvText.trim() === '') {
        toast.warning('⚠️ No data available', {
          description: 'No performance data found for this user and date range.',
        });
        setPerformanceData(null);
        return;
      }
      
      const parsed = parseCSV(csvText);
      setPerformanceData({ csv: csvText, blob, parsed });
      
      toast.success('✅ Performance data loaded successfully', {
        description: `Found ${parsed.rows.length} record(s).`,
      });
    } catch (error) {
      console.error('Error fetching user performance:', error);
      const errorMessage = error?.message || 'Failed to fetch performance data. Please try again.';
      toast.error('❌ Failed to load performance data', {
        description: errorMessage,
      });
      setPerformanceData(null);
    } finally {
      setPerformanceLoading(false);
    }
  };

  // Tab 3: Download User Performance
  const handleDownloadPerformance = () => {
    if (!performanceData) return;
    
    try {
      const user = users.find(u => u.id === performanceUserId);
      const userName = user ? user.name : 'User';
      const fileName = `Review_${userName}_${format(performanceStartDate, 'yyyy-MM-dd')}.csv`;
      
      const url = window.URL.createObjectURL(performanceData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('✅ CSV downloaded successfully', {
        description: `File: ${fileName}`,
      });
    } catch (error) {
      toast.error('❌ Failed to download CSV', {
        description: 'An error occurred while downloading the file.',
      });
    }
  };

  // User options with email
  const userOptions = useMemo(() => {
    return users.map(user => {
      const displayName = user.email 
        ? `${user.name} (${user.email})`
        : user.name;
      return {
        id: user.id,
        displayName,
        name: user.name,
        email: user.email,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

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
    return <LoaderThreeDemo />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Reports Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate and download reports for daily roster, project history, and user performance
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

      <Tabs defaultValue="roster" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roster">Daily Roster</TabsTrigger>
          <TabsTrigger value="history">Project History</TabsTrigger>
          <TabsTrigger value="performance">User Performance</TabsTrigger>
        </TabsList>

        {/* TAB 1: Daily Roster */}
        <TabsContent value="roster" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Daily Attendance & Role Roster
              </CardTitle>
              <CardDescription>
                Preview and download daily roster reports for attendance and role assignments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Select Project</Label>
                  <Combobox
                    items={[
                      'All Projects',
                      ...projects.map((project) => `${project.name} (${project.code})`),
                    ]}
                    value={
                      rosterProjectId === 'all'
                        ? 'All Projects'
                        : (projects.find((p) => p.id === rosterProjectId)
                            ? `${projects.find((p) => p.id === rosterProjectId).name} (${projects.find((p) => p.id === rosterProjectId).code})`
                            : '')
                    }
                    onValueChange={(label) => {
                      if (label === 'All Projects') {
                        setRosterProjectId('all');
                        return;
                      }
                      const matched = projects.find((project) => `${project.name} (${project.code})` === label);
                      setRosterProjectId(matched?.id || 'all');
                    }}
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
                  <Label>From Date</Label>
                  <Popover open={rosterStartPickerOpen} onOpenChange={setRosterStartPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(rosterStartDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={rosterStartDate}
                        onSelect={(date) => {
                          if (date) {
                            setRosterStartDate(date);
                            setRosterStartPickerOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover open={rosterEndPickerOpen} onOpenChange={setRosterEndPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(rosterEndDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={rosterEndDate}
                        onSelect={(date) => {
                          if (date) {
                            setRosterEndDate(date);
                            setRosterEndPickerOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button
                onClick={handlePreviewRoster}
                disabled={rosterLoading}
                className="w-full"
                size="lg"
              >
                {rosterLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Preview Roster
                  </>
                )}
              </Button>

              {rosterLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : rosterData && rosterData.parsed.rows.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-md border overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          {rosterData.parsed.headers.map(header => (
                            <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rosterData.parsed.rows.map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/50">
                            {rosterData.parsed.headers.map(header => (
                              <TableCell key={header} className="whitespace-nowrap">
                                {row[header] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    onClick={handleDownloadRoster}
                    className="w-full"
                    size="lg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              ) : rosterData && rosterData.parsed.rows.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No roster data found for the selected date range and project.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Project History */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Project Hall of Fame
              </CardTitle>
              <CardDescription>
                Preview and download project history reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Select Project</Label>
                  <Combobox
                    items={projects.map((project) => `${project.name} (${project.code})`)}
                    value={
                      historyProjectId
                        ? (projects.find((p) => p.id === historyProjectId)
                            ? `${projects.find((p) => p.id === historyProjectId).name} (${projects.find((p) => p.id === historyProjectId).code})`
                            : '')
                        : ''
                    }
                    onValueChange={(label) => {
                      const matched = projects.find((project) => `${project.name} (${project.code})` === label);
                      setHistoryProjectId(matched?.id || '');
                    }}
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
                  <Label>From Date</Label>
                  <Popover open={historyStartPickerOpen} onOpenChange={setHistoryStartPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(historyStartDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={historyStartDate}
                        onSelect={(date) => {
                          if (date) {
                            setHistoryStartDate(date);
                            setHistoryStartPickerOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover open={historyEndPickerOpen} onOpenChange={setHistoryEndPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(historyEndDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={historyEndDate}
                        onSelect={(date) => {
                          if (date) {
                            setHistoryEndDate(date);
                            setHistoryEndPickerOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button
                onClick={handlePreviewHistory}
                disabled={!historyProjectId || historyLoading}
                className="w-full"
                size="lg"
              >
                {historyLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Preview History
                  </>
                )}
              </Button>

              {historyLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : historyData && historyData.parsed.rows.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-md border overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          {historyData.parsed.headers.map(header => (
                            <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyData.parsed.rows.map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/50">
                            {historyData.parsed.headers.map(header => (
                              <TableCell key={header} className="whitespace-nowrap">
                                {row[header] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    onClick={handleDownloadHistory}
                    className="w-full"
                    size="lg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              ) : historyData && historyData.parsed.rows.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No history data found for this project.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: User Performance */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Individual Performance Review
              </CardTitle>
              <CardDescription>
                Preview and download user performance reports for a specific date range
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {users.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No users found.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Select User</Label>
                    <Combobox
                      items={userOptions.map((user) => user.displayName)}
                      value={
                        performanceUserId
                          ? (userOptions.find((u) => u.id === performanceUserId)?.displayName || '')
                          : ''
                      }
                      onValueChange={(display) => {
                        const matched = userOptions.find((u) => u.displayName === display);
                        setPerformanceUserId(matched?.id || '');
                      }}
                    >
                      <ComboboxInput placeholder="Select user" className="w-full" />
                      <ComboboxContent>
                        <ComboboxEmpty>No user found.</ComboboxEmpty>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Popover open={performanceStartPickerOpen} onOpenChange={setPerformanceStartPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(performanceStartDate, 'PPP')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={performanceStartDate}
                            onSelect={(date) => {
                              if (date) {
                                setPerformanceStartDate(date);
                                setPerformanceStartPickerOpen(false);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover open={performanceEndPickerOpen} onOpenChange={setPerformanceEndPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(performanceEndDate, 'PPP')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={performanceEndDate}
                            onSelect={(date) => {
                              if (date) {
                                setPerformanceEndDate(date);
                                setPerformanceEndPickerOpen(false);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Button
                    onClick={handlePreviewPerformance}
                    disabled={!performanceUserId || performanceLoading}
                    className="w-full"
                    size="lg"
                  >
                    {performanceLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Preview Performance
                      </>
                    )}
                  </Button>

                  {performanceLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : performanceData && performanceData.parsed.rows.length > 0 ? (
                    <div className="space-y-4">
                      <div className="rounded-md border overflow-auto max-h-[500px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                              {performanceData.parsed.headers.map(header => (
                                <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {performanceData.parsed.rows.map((row, idx) => (
                              <TableRow key={idx} className="hover:bg-muted/50">
                                {performanceData.parsed.headers.map(header => (
                                  <TableCell key={header} className="whitespace-nowrap">
                                    {row[header] || '-'}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <Button
                        onClick={handleDownloadPerformance}
                        className="w-full"
                        size="lg"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Report
                      </Button>
                    </div>
                  ) : performanceData && performanceData.parsed.rows.length === 0 ? (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No performance data found for this user and date range.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsCenter;
