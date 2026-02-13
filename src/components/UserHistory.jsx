import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedRequest } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { History, Download, Search, Info } from 'lucide-react';
import { toast } from 'sonner';

const allowedRoles = ['USER', 'ADMIN', 'MANAGER'];

const UserHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [roleFilter, setRoleFilter] = useState('All Roles');

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

  const totalHours = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (Number(row.minutes_worked || 0) / 60), 0),
    [filteredRows]
  );
  const totalTasks = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.tasks_completed || 0), 0),
    [filteredRows]
  );

  const handleFetch = async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.warning('Invalid date range', { description: 'Date From cannot be after Date To.' });
      return;
    }
    try {
      setLoading(true);
      const params = {};
      if (dateFrom) params.start_date = dateFrom;
      if (dateTo) params.end_date = dateTo;
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
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Hours</div>
            <div className="text-2xl font-semibold">{totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tasks Completed</div>
            <div className="text-2xl font-semibold">{totalTasks}</div>
          </CardContent>
        </Card>
      </div>

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
