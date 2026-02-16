import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedRequest, getAllProjects, getProjectMetrics, getUsersWithFilter } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { HoverEffect } from '@/components/ui/card-hover-effect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { LoaderThreeDemo } from './LoaderDemo';
import { Calendar as CalendarIcon, Clock3, Info, Target, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useFiltersUpdatedToast } from '@/hooks/useFiltersUpdatedToast';

const TeamStats = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedProject, setSelectedProject] = useState('All Projects');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [metricsRows, setMetricsRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const userProjects = useMemo(
    () => projects.filter((p) => p.current_user_role && p.current_user_role !== 'N/A'),
    [projects]
  );

  const projectOptions = useMemo(
    () => ['All Projects', ...userProjects.map((p) => p.name).filter(Boolean)],
    [userProjects]
  );

  const selectedProjectIds = useMemo(() => {
    if (selectedProject === 'All Projects') return userProjects.map((p) => p.id);
    const match = userProjects.find((p) => p.name === selectedProject);
    return match ? [match.id] : [];
  }, [selectedProject, userProjects]);

  const filtersSignature = useMemo(
    () =>
      JSON.stringify({
        selectedDate,
        selectedProject,
      }),
    [selectedDate, selectedProject]
  );

  const dataSignature = useMemo(() => {
    const totalHours = metricsRows.reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const totalTasks = metricsRows.reduce((sum, row) => sum + Number(row.tasks_completed || 0), 0);
    return `${teamUsers.length}|${metricsRows.length}|${totalHours.toFixed(2)}|${totalTasks.toFixed(2)}`;
  }, [teamUsers, metricsRows]);

  useFiltersUpdatedToast({
    filtersSignature,
    dataSignature,
    enabled: !loading && !initialLoading,
    message: 'Filters updated',
  });

  const counts = useMemo(() => {
    const total = teamUsers.length;
    const present = teamUsers.filter((u) => u.today_status === 'PRESENT').length;
    const absent = teamUsers.filter((u) => u.today_status === 'ABSENT').length;
    return { total, present, absent };
  }, [teamUsers]);

  const totals = useMemo(() => {
    const totalHours = metricsRows.reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const totalTasks = metricsRows.reduce((sum, row) => sum + Number(row.tasks_completed || 0), 0);
    return { totalHours, totalTasks };
  }, [metricsRows]);

  const kpiItems = useMemo(() => ([
    {
      id: 'team-total-users',
      title: 'Total Users',
      value: counts.total,
      icon: <Users className="h-4 w-4" />,
      description: 'Users in current team scope',
    },
    {
      id: 'team-present',
      title: 'Present',
      value: counts.present,
      icon: <UserCheck className="h-4 w-4" />,
      description: 'Users marked present today',
    },
    {
      id: 'team-absent',
      title: 'Absent',
      value: counts.absent,
      icon: <UserX className="h-4 w-4" />,
      description: 'Users marked absent today',
    },
    {
      id: 'team-total-hours',
      title: 'Total Hours',
      value: totals.totalHours.toFixed(1),
      icon: <Clock3 className="h-4 w-4" />,
      description: 'Hours logged for selected day',
    },
    {
      id: 'team-total-tasks',
      title: 'Total Tasks',
      value: totals.totalTasks,
      icon: <Target className="h-4 w-4" />,
      description: 'Tasks completed for selected day',
    },
  ]), [counts, totals]);

  const fetchProjects = async () => {
    try {
      const list = await getAllProjects();
      const projectList = Array.isArray(list) ? list : [];
      setProjects(projectList);
      if (projectList.length && selectedProject === 'All Projects') return;
      if (!projectList.find((p) => p.name === selectedProject)) setSelectedProject('All Projects');
    } catch (error) {
      toast.error('Failed to load projects', { description: error?.message || 'Please try again.' });
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      await Promise.all([
        fetchProjects(),
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

  const loadStats = async () => {
    try {
      setLoading(true);
      if (!selectedProjectIds.length) {
        setTeamUsers([]);
        setMetricsRows([]);
        return;
      }
      const teamIds = new Set();
      for (const projectId of selectedProjectIds) {
        const members = await authenticatedRequest('GET', `/admin/projects/${projectId}/members`);
        (Array.isArray(members) ? members : []).forEach((m) => {
          if (m?.user_id) teamIds.add(String(m.user_id).toLowerCase());
        });
      }

      const usersWithStatus = await getUsersWithFilter(selectedDate);
      const usersList = Array.isArray(usersWithStatus) ? usersWithStatus : [];
      const team = usersList.filter((u) => teamIds.has(String(u.id || u.user_id || '').toLowerCase()));
      setTeamUsers(team);

      const allMetrics = [];
      for (const projectId of selectedProjectIds) {
        const rows = await getProjectMetrics(projectId, selectedDate, selectedDate);
        allMetrics.push(...(Array.isArray(rows) ? rows : []));
      }
      setMetricsRows(allMetrics);
    } catch (error) {
      toast.error('Failed to load team stats', { description: error?.message || 'Please try again.' });
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

  if (initialLoading) {
    return <LoaderThreeDemo />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          Team Stats
        </h1>
        <p className="text-muted-foreground mt-1">Team-level view across projects where you are currently allocated.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Choose date and project scope.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(new Date(`${selectedDate}T00:00:00`), 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(`${selectedDate}T00:00:00`)}
                  onSelect={(date) => {
                    if (date) setSelectedDate(format(date, 'yyyy-MM-dd'));
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Combobox items={projectOptions} value={selectedProject} onValueChange={setSelectedProject}>
              <ComboboxInput placeholder="Select project" className="w-full" />
              <ComboboxContent>
                <ComboboxEmpty>No project found.</ComboboxEmpty>
                <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="flex items-end">
            <Button onClick={loadStats} disabled={loading} className="w-full">
              {loading ? 'Loading...' : 'Load Team Stats'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <HoverEffect items={kpiItems} className="grid-cols-2 md:grid-cols-5 lg:grid-cols-5" />

      <Card>
        <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
        <CardContent>
          {!teamUsers.length ? (
            <Alert><AlertDescription>No team member data loaded yet.</AlertDescription></Alert>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Today Status</TableHead>
                    <TableHead>Allocated Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamUsers.map((u) => (
                    <TableRow key={u.id || u.user_id}>
                      <TableCell>{u.name || '-'}</TableCell>
                      <TableCell>{u.email || '-'}</TableCell>
                      <TableCell>{u.today_status || 'UNKNOWN'}</TableCell>
                      <TableCell>{u.allocated_projects ?? '-'}</TableCell>
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

export default TeamStats;
