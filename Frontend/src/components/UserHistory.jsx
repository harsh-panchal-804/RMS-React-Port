import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedRequest } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { HoverEffect } from '@/components/ui/card-hover-effect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { LoaderThreeDemo } from './LoaderDemo';
import { Calendar as CalendarIcon, History, Download, Search, Info, Clock3, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useFiltersUpdatedToast } from '@/hooks/useFiltersUpdatedToast';

const allowedRoles = ['USER', 'ADMIN', 'MANAGER'];

const UserHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [initialLoading, setInitialLoading] = useState(true);

  const projectOptions = useMemo(() => {
    const projects = [...new Set(rows.map((row) => row.project_name).filter(Boolean))].sort();
    return ['All Projects', ...projects];
  }, [rows]);

  const roleOptions = useMemo(() => {
    const roles = [...new Set(rows.map((row) => row.work_role).filter(Boolean))].sort();
    return ['All Roles', ...roles];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (projectFilter !== 'All Projects' && row.project_name !== projectFilter) return false;
      if (roleFilter !== 'All Roles' && row.work_role !== roleFilter) return false;
      return true;
    });
  }, [rows, projectFilter, roleFilter]);

  const filtersSignature = useMemo(
    () =>
      JSON.stringify({
        dateFrom,
        dateTo,
        projectFilter,
        roleFilter,
      }),
    [dateFrom, dateTo, projectFilter, roleFilter]
  );

  const dataSignature = useMemo(() => {
    const totalHoursSig = filteredRows.reduce((sum, row) => sum + Number(row.minutes_worked || 0), 0);
    const totalTasksSig = filteredRows.reduce((sum, row) => sum + Number(row.tasks_completed || 0), 0);
    return `${filteredRows.length}|${totalHoursSig.toFixed(2)}|${totalTasksSig.toFixed(2)}`;
  }, [filteredRows]);

  useFiltersUpdatedToast({
    filtersSignature,
    dataSignature,
    enabled: !loading && !initialLoading,
    message: 'Filters updated',
  });

  const totalHours = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (Number(row.minutes_worked || 0) / 60), 0),
    [filteredRows]
  );
  const totalTasks = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.tasks_completed || 0), 0),
    [filteredRows]
  );

  const kpiItems = useMemo(() => ([
    {
      id: 'history-total-hours',
      title: 'Total Hours',
      value: `${totalHours.toFixed(1)}h`,
      icon: <Clock3 className="h-4 w-4" />,
      description: 'Hours in filtered range',
    },
    {
      id: 'history-total-tasks',
      title: 'Tasks Completed',
      value: String(totalTasks),
      icon: <Target className="h-4 w-4" />,
      description: 'Tasks in filtered range',
    },
  ]), [totalHours, totalTasks]);

  const fetchHistory = async (startDate = dateFrom, endDate = dateTo) => {
    if (startDate && endDate && startDate > endDate) {
      toast.warning('Invalid date range', { description: 'Date From cannot be after Date To.' });
      return;
    }
    try {
      setLoading(true);
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const data = await authenticatedRequest('GET', '/time/history', params);
      setRows(Array.isArray(data) ? data : []);
      setProjectFilter('All Projects');
      setRoleFilter('All Roles');
    } catch (error) {
      toast.error('Failed to load history', { description: error?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    await fetchHistory();
  };

  const handleDownload = () => {
    if (!filteredRows.length) {
      toast.warning('No records to export');
      return;
    }
    const headers = ['Date', 'Project', 'Role', 'Clock In', 'Clock Out', 'Minutes Worked', 'Tasks', 'Status'];
    const csv = [
      headers.join(','),
      ...filteredRows.map((row) =>
        [
          row.sheet_date || '',
          row.project_name || '',
          row.work_role || '',
          row.clock_in_at || '',
          row.clock_out_at || '',
          row.minutes_worked ?? '',
          row.tasks_completed ?? '',
          row.status || '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user_history_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      setDateFrom(today);
      setDateTo(today);
      await Promise.all([
        fetchHistory(today, today),
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
  }, []);

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Access denied. User/Admin/Manager role required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (initialLoading) {
    return <LoaderThreeDemo />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          History
        </h1>
        <p className="text-muted-foreground mt-1">Review your detailed work logs and download CSV reports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by date, project and role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(`${dateFrom}T00:00:00`), 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(`${dateFrom}T00:00:00`)}
                    onSelect={(date) => {
                      if (date) setDateFrom(format(date, 'yyyy-MM-dd'));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(`${dateTo}T00:00:00`), 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(`${dateTo}T00:00:00`)}
                    onSelect={(date) => {
                      if (date) setDateTo(format(date, 'yyyy-MM-dd'));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Combobox items={projectOptions} value={projectFilter} onValueChange={setProjectFilter}>
                <ComboboxInput placeholder="Select project" className="w-full" />
                <ComboboxContent>
                  <ComboboxEmpty>No project found.</ComboboxEmpty>
                  <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Combobox items={roleOptions} value={roleFilter} onValueChange={setRoleFilter}>
                <ComboboxInput placeholder="Select role" className="w-full" />
                <ComboboxContent>
                  <ComboboxEmpty>No role found.</ComboboxEmpty>
                  <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleFetch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Loading...' : 'Apply'}
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <HoverEffect items={kpiItems} className="grid-cols-1 md:grid-cols-2 lg:grid-cols-2" />

      <Card>
        <CardHeader>
          <CardTitle>Detailed Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {!filteredRows.length ? (
            <Alert><AlertDescription>No records found for selected filters.</AlertDescription></Alert>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id || `${row.sheet_date}-${row.project_name}-${row.clock_in_at}`}>
                      <TableCell>{row.sheet_date || '-'}</TableCell>
                      <TableCell>{row.project_name || '-'}</TableCell>
                      <TableCell>{row.work_role || '-'}</TableCell>
                      <TableCell>{((Number(row.minutes_worked || 0) / 60) || 0).toFixed(1)}</TableCell>
                      <TableCell>{row.tasks_completed || 0}</TableCell>
                      <TableCell><Badge variant="outline">{row.status || '-'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserHistory;
