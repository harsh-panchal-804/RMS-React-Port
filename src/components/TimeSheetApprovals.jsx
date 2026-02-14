import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { authenticatedRequest, getAllProjects } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoaderThreeDemo } from './LoaderDemo';
import {
  ClipboardCheck,
  Calendar as CalendarIcon,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  User,
  Download,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const formatClockTime = (value) => {
  if (!value) return '-';
  try {
    const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return format(parsed, 'hh:mm a');
  } catch {
    return String(value);
  }
};

const TimeSheetApprovals = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [userFilter, setUserFilter] = useState('All Users');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [rowRejectDialogOpen, setRowRejectDialogOpen] = useState(false);
  const [rowRejectHistoryId, setRowRejectHistoryId] = useState(null);
  const [rowRejectReason, setRowRejectReason] = useState('');

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [projectsData, pendingData] = await Promise.all([
        getAllProjects(),
        authenticatedRequest('GET', '/admin/dashboard/pending-approvals'),
      ]);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setPendingItems(Array.isArray(pendingData) ? pendingData : []);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to load time sheet approvals', {
        description: error?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      await fetchData();
      if (isMounted) {
        setInitialLoading(false);
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateTo(dateFrom);
    }
  }, [dateFrom, dateTo]);

  const roleOptions = useMemo(() => {
    const roles = [...new Set(pendingItems.map((item) => item.work_role).filter(Boolean))].sort();
    return ['All Roles', ...roles];
  }, [pendingItems]);

  const userOptions = useMemo(() => {
    const users = [...new Set(pendingItems.map((item) => item.user_name).filter(Boolean))].sort();
    return ['All Users', ...users];
  }, [pendingItems]);

  const projectOptions = useMemo(() => {
    const projectNamesFromPending = [...new Set(pendingItems.map((item) => item.project_name).filter(Boolean))];
    const projectNamesFromMaster = projects.map((p) => p.name).filter(Boolean);
    const allProjectNames = [...new Set([...projectNamesFromMaster, ...projectNamesFromPending])].sort();
    return ['All Projects', ...allProjectNames];
  }, [projects, pendingItems]);

  const filteredItems = useMemo(() => {
    let result = [...pendingItems];
    if (projectFilter !== 'All Projects') {
      result = result.filter((item) => item.project_name === projectFilter);
    }
    if (userFilter !== 'All Users') {
      result = result.filter((item) => item.user_name === userFilter);
    }
    if (roleFilter !== 'All Roles') {
      result = result.filter((item) => item.work_role === roleFilter);
    }
    if (dateFrom) {
      const from = format(dateFrom, 'yyyy-MM-dd');
      result = result.filter((item) => String(item.sheet_date || '') >= from);
    }
    if (dateTo) {
      const to = format(dateTo, 'yyyy-MM-dd');
      result = result.filter((item) => String(item.sheet_date || '') <= to);
    }
    return result;
  }, [pendingItems, projectFilter, userFilter, roleFilter, dateFrom, dateTo]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(String(item.history_id)));

  const toggleSelectAllVisible = (checked) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    const next = new Set(filteredItems.map((item) => String(item.history_id)));
    setSelectedIds(next);
  };

  const toggleRowSelected = (historyId, checked) => {
    const key = String(historyId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const submitDecision = async (historyId, action, notes = '') => {
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    await authenticatedRequest('PUT', `/time/history/${historyId}/approve`, {
      status,
      approval_comment: notes || '',
    });
  };

  const handleDownloadDataTableCsv = () => {
    if (!filteredItems.length) {
      toast.warning('No data to export');
      return;
    }

    const headers = ['User', 'Project', 'Work Role', 'Date', 'Clock In', 'Clock Out', 'Duration', 'Tasks'];
    const rows = filteredItems.map((item) => [
      item.user_name || '-',
      item.project_name || '-',
      item.work_role || '-',
      item.sheet_date || '-',
      formatClockTime(item.clock_in),
      formatClockTime(item.clock_out),
      item.duration_minutes ? `${item.duration_minutes.toFixed(1)} min` : '0 min',
      String(item.tasks_completed || 0),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `time_sheet_approvals_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSingleAction = async (historyId, action, notes = '') => {
    try {
      setSubmitting(true);
      const finalNotes = action === 'approve' ? 'Approved via Inbox' : notes;
      await submitDecision(historyId, action, finalNotes);
      toast.success(action === 'approve' ? 'Approved' : 'Rejected');
      await fetchData();
    } catch (error) {
      toast.error(`Failed to ${action}`, {
        description: error?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAction = async (action, notes = '') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setSubmitting(true);
      let success = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          const finalNotes = action === 'approve' ? 'Bulk approved via Inbox' : notes;
          await submitDecision(id, action, finalNotes);
          success += 1;
        } catch {
          failed += 1;
        }
      }
      if (success > 0) toast.success(`Successfully ${action === 'approve' ? 'approved' : 'rejected'} ${success} item(s)`);
      if (failed > 0) toast.error(`Failed for ${failed} item(s)`);
      setSelectedIds(new Set());
      setBulkRejectReason('');
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Access denied. Admin or Manager role required.</AlertDescription>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8" />
            Time Sheet Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Verify and approve team time sheets. Only project managers and admins can see approvals for their projects.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading || submitting}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Project</Label>
            <Combobox items={projectOptions} value={projectFilter} onValueChange={setProjectFilter}>
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
            <Label>User</Label>
            <Combobox items={userOptions} value={userFilter} onValueChange={setUserFilter}>
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
          <div className="space-y-2">
            <Label>Work Role</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dateFrom ? format(dateFrom, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Date To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dateTo ? format(dateTo, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {filteredItems.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Results: {filteredItems.length} Pending Item(s)</CardTitle>
              <CardDescription>Use select all with bulk approve/reject for faster review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-timesheet"
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleSelectAllVisible(Boolean(checked))}
                  />
                  <Label htmlFor="select-all-timesheet">Select All</Label>
                  <Badge variant="outline">{selectedIds.size} selected</Badge>
                </div>
                <Button
                  onClick={() => handleBulkAction('approve')}
                  disabled={selectedIds.size === 0 || submitting}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve Selected ({selectedIds.size})
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setBulkRejectDialogOpen(true)}
                  disabled={selectedIds.size === 0 || submitting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Selected ({selectedIds.size})
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Work Role</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const historyId = String(item.history_id);
                      const selected = selectedIds.has(historyId);
                      return (
                        <TableRow key={historyId}>
                          <TableCell>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(checked) => toggleRowSelected(historyId, Boolean(checked))}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {item.user_name || '-'}
                            </div>
                          </TableCell>
                          <TableCell>{item.project_name || '-'}</TableCell>
                          <TableCell>{item.work_role || '-'}</TableCell>
                          <TableCell>{item.sheet_date || '-'}</TableCell>
                          <TableCell>{formatClockTime(item.clock_in)}</TableCell>
                          <TableCell>{formatClockTime(item.clock_out)}</TableCell>
                          <TableCell>{item.duration_minutes ? `${item.duration_minutes.toFixed(1)} min` : '0 min'}</TableCell>
                          <TableCell>{item.tasks_completed || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSingleAction(historyId, 'approve')}
                                disabled={submitting}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={submitting}
                                onClick={() => {
                                  setRowRejectHistoryId(historyId);
                                  setRowRejectReason('');
                                  setRowRejectDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Data Table View</CardTitle>
                  <CardDescription>Read-only table for quick scan and export.</CardDescription>
                </div>
                <Button variant="outline" onClick={handleDownloadDataTableCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Work Role</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Tasks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={`readonly-${item.history_id}`}>
                        <TableCell>{item.user_name || '-'}</TableCell>
                        <TableCell>{item.project_name || '-'}</TableCell>
                        <TableCell>{item.work_role || '-'}</TableCell>
                        <TableCell>{item.sheet_date || '-'}</TableCell>
                        <TableCell>{formatClockTime(item.clock_in)}</TableCell>
                        <TableCell>{formatClockTime(item.clock_out)}</TableCell>
                        <TableCell>{item.duration_minutes ? `${item.duration_minutes.toFixed(1)} min` : '0 min'}</TableCell>
                        <TableCell>{item.tasks_completed || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {pendingItems.length === 0
              ? 'All caught up. No pending approvals.'
              : `No items match selected filters. Total pending: ${pendingItems.length}`}
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={rowRejectDialogOpen} onOpenChange={setRowRejectDialogOpen}>
        <DialogContent overlayClassName="backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Reject Time Sheet</DialogTitle>
            <DialogDescription>Add an optional reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rowRejectReason}
              onChange={(e) => setRowRejectReason(e.target.value)}
              placeholder="Reason (optional)"
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={!rowRejectHistoryId || submitting}
              onClick={async () => {
                await handleSingleAction(rowRejectHistoryId, 'reject', rowRejectReason);
                setRowRejectDialogOpen(false);
                setRowRejectHistoryId(null);
                setRowRejectReason('');
              }}
            >
              Confirm Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent overlayClassName="backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Bulk Reject Time Sheets</DialogTitle>
            <DialogDescription>
              You are rejecting {selectedIds.size} selected item(s). Add an optional reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="Rejection reason (optional)"
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={selectedIds.size === 0 || submitting}
              onClick={async () => {
                await handleBulkAction('reject', bulkRejectReason);
                setBulkRejectDialogOpen(false);
                setBulkRejectReason('');
              }}
            >
              Confirm Bulk Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeSheetApprovals;
