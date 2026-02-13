import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedRequest, getAllProjects } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from '@/components/ui/combobox';
import { ClipboardList, Info } from 'lucide-react';
import { toast } from 'sonner';

const typeOptions = ['SICK_LEAVE', 'FULL-DAY', 'HALF-DAY', 'WFH', 'REGULARIZATION', 'SHIFT_CHANGE', 'OTHER'];

const AttendanceRequests = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [requestType, setRequestType] = useState('SICK_LEAVE');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTimeValue, setEndTimeValue] = useState('18:00');
  const [cancelId, setCancelId] = useState('');
  const [cancelDrawerOpen, setCancelDrawerOpen] = useState(false);

  const counts = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, projData] = await Promise.all([
        authenticatedRequest('GET', '/attendance/requests'),
        getAllProjects(),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      setProjects(Array.isArray(projData) ? projData : []);
    } catch (error) {
      toast.error('Failed to load requests', { description: error?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const submitRequest = async () => {
    if (!reason.trim()) {
      toast.warning('Reason is required');
      return;
    }
    if (requestType !== 'HALF-DAY' && endDate < startDate) {
      toast.warning('End date must be on/after start date');
      return;
    }
    const isTimed = requestType === 'SHIFT_CHANGE' || requestType === 'REGULARIZATION';
    if (isTimed && endTimeValue <= startTime) {
      toast.warning('End time must be after start time');
      return;
    }
    const payload = {
      request_type: requestType,
      start_date: startDate,
      end_date: requestType === 'HALF-DAY' ? startDate : endDate,
      start_time: isTimed ? `${startTime}:00` : null,
      end_time: isTimed ? `${endTimeValue}:00` : null,
      reason: reason.trim(),
      attachment_url: null,
    };
    try {
      await authenticatedRequest('POST', '/attendance/requests/', payload);
      toast.success('Request submitted');
      setReason('');
      await fetchData();
    } catch (error) {
      toast.error('Failed to submit request', { description: error?.message || 'Please try again.' });
    }
  };

  const requestCancel = (id) => {
    setCancelId(id);
    setCancelDrawerOpen(true);
  };

  const confirmCancel = async () => {
    try {
      await authenticatedRequest('DELETE', `/attendance/requests/${cancelId}`);
      toast.success('Request canceled');
      setCancelDrawerOpen(false);
      setCancelId('');
      await fetchData();
    } catch (error) {
      toast.error('Failed to cancel request', { description: error?.message || 'Please try again.' });
    }
  };

  const renderRows = (status) => {
    const filtered = status === 'ALL' ? requests : requests.filter((r) => r.status === status);
    if (!filtered.length) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center text-muted-foreground">No requests found.</TableCell>
        </TableRow>
      );
    }
    return filtered.map((r) => (
      <TableRow key={r.id}>
        <TableCell>{r.request_type || '-'}</TableCell>
        <TableCell>{r.start_date || '-'}</TableCell>
        <TableCell>{r.end_date || '-'}</TableCell>
        <TableCell>{r.status || '-'}</TableCell>
        <TableCell>{r.review_comment || '-'}</TableCell>
        <TableCell>{r.requested_at || r.created_at || '-'}</TableCell>
        <TableCell>
          {r.status === 'PENDING' ? (
            <Button variant="destructive" size="sm" onClick={() => requestCancel(r.id)}>Cancel</Button>
          ) : '-'}
        </TableCell>
      </TableRow>
    ));
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
          <ClipboardList className="h-8 w-8" />
          Leave/WFH Requests
        </h1>
        <p className="text-muted-foreground mt-1">Create and manage leave/WFH requests.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total</div><div className="text-2xl font-semibold">{counts.total}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Pending</div><div className="text-2xl font-semibold">{counts.pending}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Approved</div><div className="text-2xl font-semibold">{counts.approved}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Rejected</div><div className="text-2xl font-semibold">{counts.rejected}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Request</CardTitle>
          <CardDescription>Submit a leave or attendance-related request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Combobox items={typeOptions} value={requestType} onValueChange={setRequestType}>
                <ComboboxInput placeholder="Select type" className="w-full" />
                <ComboboxContent><ComboboxEmpty>No type found.</ComboboxEmpty><ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList></ComboboxContent>
              </Combobox>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={requestType === 'HALF-DAY' ? startDate : endDate} onChange={(e) => setEndDate(e.target.value)} disabled={requestType === 'HALF-DAY'} />
            </div>
          </div>

          {(requestType === 'SHIFT_CHANGE' || requestType === 'REGULARIZATION') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              <div className="space-y-2"><Label>End Time</Label><Input type="time" value={endTimeValue} onChange={(e) => setEndTimeValue(e.target.value)} /></div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason..." />
          </div>

          <Button onClick={submitRequest} disabled={loading}>Submit Request</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Request History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ALL" className="space-y-4">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="ALL">All</TabsTrigger>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
              <TabsTrigger value="APPROVED">Approved</TabsTrigger>
              <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
            </TabsList>
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
              <TabsContent key={status} value={status}>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Review Comment</TableHead>
                        <TableHead>Requested At</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{renderRows(status)}</TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Drawer open={cancelDrawerOpen} onOpenChange={setCancelDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Cancel this request?</DrawerTitle>
            <DrawerDescription>This cannot be undone once canceled.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="items-center">
            <Button variant="destructive" onClick={confirmCancel} className="w-[70vw] max-w-[720px]">Confirm Cancel</Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-[70vw] max-w-[720px]">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AttendanceRequests;
