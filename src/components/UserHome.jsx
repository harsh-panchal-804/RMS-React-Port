import { useEffect, useMemo, useState } from 'react';
import { eachDayOfInterval, format, subDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedRequest, getAllProjects } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Button as StatefulButton } from '@/components/ui/stateful-button';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { LoaderThreeDemo } from './LoaderDemo';
import { Home, Info, Minus, PlayCircle, Plus, Square } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

const TasksTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-md border bg-background/95 px-2 py-1 text-xs shadow-md">
      Tasks done: {value}
    </div>
  );
};

const UserHome = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [clockInPressed, setClockInPressed] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedRole, setSelectedRole] = useState(defaultRoles[0]);
  const [clockoutOpen, setClockoutOpen] = useState(false);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [editingTasks, setEditingTasks] = useState(false);
  const [taskDraft, setTaskDraft] = useState('0');
  const [notes, setNotes] = useState('');
  const [weeklyTaskData, setWeeklyTaskData] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

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
      const weekStart = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      const [currentData, historyData, weeklyData] = await Promise.all([
        authenticatedRequest('GET', '/time/current'),
        authenticatedRequest('GET', '/time/history', {
          start_date: today,
          end_date: today,
        }),
        authenticatedRequest('GET', '/time/history', {
          start_date: weekStart,
          end_date: today,
        }),
      ]);
      const activeSession = currentData || null;
      const sessions = Array.isArray(historyData) ? historyData : [];
      const weeklySessions = Array.isArray(weeklyData) ? weeklyData : [];

      setCurrentSession(activeSession);
      setTodaySessions(sessions);
      const dateRange = eachDayOfInterval({
        start: subDays(new Date(), 6),
        end: new Date(),
      });
      const totalsByDate = dateRange.reduce((acc, date) => {
        acc[format(date, 'yyyy-MM-dd')] = 0;
        return acc;
      }, {});
      weeklySessions.forEach((session) => {
        const rawDate =
          session.metric_date ||
          session.date ||
          (session.clock_in_at ? String(session.clock_in_at).slice(0, 10) : null);
        if (!rawDate || !(rawDate in totalsByDate)) return;
        totalsByDate[rawDate] += Number(session.tasks_completed || 0);
      });
      setWeeklyTaskData(
        dateRange.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          return {
            date: format(date, 'EEE'),
            fullDate: dateKey,
            totalTasks: totalsByDate[dateKey] || 0,
          };
        })
      );

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
    let isMounted = true;
    const loadInitialData = async () => {
      await fetchHomeData();
      if (isMounted) {
        setInitialLoading(false);
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
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

  const handleStartSessionClick = async () => {
    try {
      await startSession();
    } finally {
      setClockInPressed(false);
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

  const adjustTasks = (adjustment) => {
    setTasksCompleted((prev) => Math.max(0, Number(prev || 0) + adjustment));
  };

  const beginTaskEdit = () => {
    setTaskDraft(String(tasksCompleted));
    setEditingTasks(true);
  };

  const commitTaskEdit = () => {
    setTasksCompleted(Math.max(0, Number(taskDraft || 0)));
    setEditingTasks(false);
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

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderThreeDemo />
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
              <StatefulButton
                onMouseDown={() => setClockInPressed(true)}
                onTouchStart={() => setClockInPressed(true)}
                onClick={handleStartSessionClick}
                className="w-full min-w-0 rounded-md px-4 py-2 text-sm [&>div]:flex-row-reverse"
                disabled={loading}
              >
                <span className="flex items-center justify-center gap-2">
                  Start Work Session
                  {!loading && !clockInPressed && <PlayCircle className="h-4 w-4" />}
                </span>
              </StatefulButton>
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

      <Drawer open={clockoutOpen} onOpenChange={setClockoutOpen}>
        <DrawerContent className="max-h-[92vh]">
          <div className="mx-auto flex max-h-[92vh] w-full max-w-2xl flex-col">
            <DrawerHeader>
              <DrawerTitle>Submit Timesheet</DrawerTitle>
              <DrawerDescription>
                Add tasks completed and optional notes before clocking out.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 pb-2">
              <div className="flex items-center justify-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={() => adjustTasks(-1)}
                  disabled={tasksCompleted <= 0}
                >
                  <Minus className="h-4 w-4" />
                  <span className="sr-only">Decrease</span>
                </Button>
                <div className="flex-1 text-center">
                  {editingTasks ? (
                    <input
                      type="number"
                      min={0}
                      value={taskDraft}
                      autoFocus
                      onChange={(e) => setTaskDraft(e.target.value)}
                      onBlur={commitTaskEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTaskEdit();
                        if (e.key === 'Escape') setEditingTasks(false);
                      }}
                      className="w-full bg-transparent text-center text-6xl font-semibold tracking-tight outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={beginTaskEdit}
                      className="w-full text-6xl font-semibold tracking-tight"
                    >
                      {tasksCompleted}
                    </button>
                  )}
                  <div className="text-muted-foreground text-[0.70rem] uppercase">
                    Tasks/session
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={() => adjustTasks(1)}
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Increase</span>
                </Button>
              </div>

              <Separator />
              <div className="text-center">
                <p className="text-sm font-medium tracking-tight text-muted-foreground">
                  Your Average Task Throughput for Previous Week
                </p>
              </div>

              <div className="mt-3 h-[130px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTaskData} barCategoryGap="35%">
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                    <Tooltip content={<TasksTooltip />} />
                    <Bar dataKey="totalTasks" barSize={26} radius={[4, 4, 0, 0]} fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                <Label>Session Notes (Optional)</Label>
                <Textarea
                  className="min-h-8"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Briefly describe what you worked on..."
                />
              </div>
            </div>
            <DrawerFooter className="shrink-0 border-t bg-background pt-3">
              <Button onClick={submitClockout} disabled={loading} className="w-full">Confirm Submission</Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full border-border/80 bg-background text-foreground hover:bg-accent">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default UserHome;
