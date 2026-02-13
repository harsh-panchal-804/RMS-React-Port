import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedRequest } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { CalendarDays, Info, Search } from 'lucide-react';
import { toast } from 'sonner';

const AttendanceDaily = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);

  const filtered = useMemo(() => {
    const completed = sessions.filter((s) => s.clock_out_at);
    if (statusFilter === 'ALL') return completed;
    return completed.filter((s) => String(s.status || '').toUpperCase() === statusFilter);
  }, [sessions, statusFilter]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await authenticatedRequest('GET', '/time/history', {
        start_date: selectedDate,
        end_date: selectedDate,
      });
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load attendance', { description: error?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!user || !['USER', 'ADMIN', 'MANAGER'].includes(user.role)) {
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
          <CalendarDays className="h-8 w-8" />
          Attendance Daily
        </h1>
        <p className="text-muted-foreground mt-1">Daily sessions with clock-in, clock-out, hours and tasks.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Attendance Status</Label>
            <Combobox items={['ALL', 'PRESENT', 'ABSENT', 'LEAVE', 'WFH']} value={statusFilter} onValueChange={setStatusFilter}>
              <ComboboxInput placeholder="Select status" className="w-full" />
              <ComboboxContent>
                <ComboboxEmpty>No status found.</ComboboxEmpty>
                <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchSessions} disabled={loading} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Loading...' : 'Load Sessions'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {!filtered.length ? (
            <Alert><AlertDescription>No sessions found for this date.</AlertDescription></Alert>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id || `${s.project_id}-${s.clock_in_at}`}>
                      <TableCell>{s.project_name || 'Unknown'}</TableCell>
                      <TableCell>{s.work_role || '-'}</TableCell>
                      <TableCell>{s.clock_in_at || '-'}</TableCell>
                      <TableCell>{s.clock_out_at || '-'}</TableCell>
                      <TableCell>{((Number(s.minutes_worked || 0) / 60) || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(s.tasks_completed || 0)}</TableCell>
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

export default AttendanceDaily;
