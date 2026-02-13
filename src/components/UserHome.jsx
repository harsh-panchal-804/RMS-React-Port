import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedRequest, getAllProjects } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { Home, Info, PlayCircle, Square } from 'lucide-react';
import { toast } from 'sonner';

const defaultRoles = [
  'Annotation',
  'Panelist',
  'Proctoring',
  'Quality Check',
  'Retro Quality Check',
  'Super Quality Check',
  'Operations',
  'Training',
];

const UserHome = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedRole, setSelectedRole] = useState(defaultRoles[0]);
  const [clockoutOpen, setClockoutOpen] = useState(false);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [notes, setNotes] = useState('');

  const projectOptions = useMemo(() => {
    return projects.map((p) => p.name).filter(Boolean);
  }, [projects]);

  const selectedProjectObj = useMemo(
    () => projects.find((p) => p.name === selectedProject) || null,
    [projects, selectedProject]
  );

  const roleOptions = useMemo(() => {
    const mapped = projects
      .map((p) => p.current_user_role)
      .filter((r) => r && String(r).toUpperCase() !== 'N/A');
    const merged = [...new Set([...mapped, ...defaultRoles])];
    return merged.length ? merged : defaultRoles;
  }, [projects]);

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      const allProjects = await getAllProjects();
      const projectList = (Array.isArray(allProjects) ? allProjects : []).filter((p) => p.is_active !== false);
      setProjects(projectList);
      const today = format(new Date(), 'yyyy-MM-dd');
      const [currentData, historyData] = await Promise.all([
        authenticatedRequest('GET', '/time/current'),
        authenticatedRequest('GET', '/time/history', {
          start_date: today,
          end_date: today,
        }),
      ]);
      const activeSession = currentData || null;
      const sessions = Array.isArray(historyData) ? historyData : [];

      setCurrentSession(activeSession);
      setTodaySessions(sessions);

      if (activeSession?.project_name) {
        setSelectedProject(activeSession.project_name);
      } else if (projectList.length && !selectedProject) {
        setSelectedProject(projectList[0].name);
      }
      if (activeSession?.work_role) {
        setSelectedRole(activeSession.work_role);
      }
    } catch (error) {
      toast.error('Failed to load home data', { description: error?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  const startSession = async () => {
    if (!selectedProjectObj?.id) {
      toast.warning('Please select a project');
      return;
    }
    try {
      setLoading(true);
      await authenticatedRequest('POST', '/time/clock-in', {
        project_id: selectedProjectObj.id,
        work_role: selectedRole,
        clock_in_at: new Date().toISOString(),
      });
      toast.success('Clock-in successful');
      await fetchHomeData();
    } catch (error) {
      toast.error('Failed to clock in', { description: error?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const submitClockout = async () => {
    try {
      setLoading(true);
      await authenticatedRequest('PUT', '/time/clock-out', {
        tasks_completed: Number(tasksCompleted || 0),
        notes: notes || '',
      });
      toast.success('Clock-out submitted');
      setClockoutOpen(false);
      setTasksCompleted(0);
      setNotes('');
      await fetchHomeData();
    } catch (error) {
      toast.error('Failed to clock out', { description: error?.message || 'Please try again.' });
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
          <Home className="h-8 w-8" />
          Welcome, {user?.name || user?.email || 'User'}
        </h1>
        <p className="text-muted-foreground mt-1">Current time: {format(new Date(), 'HH:mm:ss')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentSession ? (
              <>
                <Badge variant="destructive">Clocked In</Badge>
                <div className="text-sm text-muted-foreground">
                  Started at: {currentSession.clock_in_at || '-'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Project: {currentSession.project_name || '-'}
                </div>
              </>
            ) : (
              <>
                <Badge variant="outline">Ready</Badge>
                <div className="text-sm text-muted-foreground">You are not working currently.</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assignment Controls</CardTitle>
            <CardDescription>Select project/role and start or stop session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Project</Label>
                <Combobox items={projectOptions} value={selectedProject} onValueChange={setSelectedProject}>
                  <ComboboxInput placeholder="Select project" className="w-full" disabled={!!currentSession} />
                  <ComboboxContent>
                    <ComboboxEmpty>No project found.</ComboboxEmpty>
                    <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div className="space-y-2">
                <Label>Select Role</Label>
                <Combobox items={roleOptions} value={selectedRole} onValueChange={setSelectedRole}>
                  <ComboboxInput placeholder="Select role" className="w-full" disabled={!!currentSession} />
                  <ComboboxContent>
                    <ComboboxEmpty>No role found.</ComboboxEmpty>
                    <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
            {currentSession ? (
              <Button onClick={() => setClockoutOpen(true)} className="w-full" variant="destructive" disabled={loading}>
                <Square className="h-4 w-4 mr-2" />
                Stop Session and Clock Out
              </Button>
            ) : (
              <Button onClick={startSession} className="w-full" disabled={loading}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Work Session
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {!todaySessions.length ? (
            <Alert><AlertDescription>No clock-in / clock-out sessions found for today.</AlertDescription></Alert>
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
                  {todaySessions.map((session) => (
                    <TableRow key={session.id || `${session.project_id}-${session.clock_in_at}`}>
                      <TableCell>{session.project_name || 'Unknown'}</TableCell>
                      <TableCell>{session.work_role || '-'}</TableCell>
                      <TableCell>{session.clock_in_at || '-'}</TableCell>
                      <TableCell>{session.clock_out_at || '-'}</TableCell>
                      <TableCell>{((Number(session.minutes_worked || 0) / 60) || 0).toFixed(2)}</TableCell>
                      <TableCell>{session.tasks_completed || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={clockoutOpen} onOpenChange={setClockoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Timesheet</DialogTitle>
            <DialogDescription>Provide tasks completed and optional notes before clocking out.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tasks Completed</Label>
              <Input type="number" min={0} value={tasksCompleted} onChange={(e) => setTasksCompleted(Number(e.target.value || 0))} />
            </div>
            <div className="space-y-2">
              <Label>Session Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Briefly describe what you did..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockoutOpen(false)}>Cancel</Button>
            <Button onClick={submitClockout} disabled={loading}>Confirm Submission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserHome;
