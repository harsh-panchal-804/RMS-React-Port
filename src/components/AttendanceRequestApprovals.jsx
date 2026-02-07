import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfToday } from 'date-fns';
import { motion } from 'framer-motion';
import {
  getAllProjects,
  getPendingAttendanceRequests,
  getAllAttendanceRequests,
  getApprovalHistory,
  submitApproval,
  updateApproval,
  deleteApproval,
  authenticatedRequest,
} from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HoverEffect } from '@/components/ui/card-hover-effect';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
  User,
  Mail,
  Clock,
  FileText,
  RefreshCw,
  AlertCircle,
  Info,
  Trash2,
  Edit,
  Download,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const REQUEST_TYPE_OPTIONS = ['SICK_LEAVE', 'WFH', 'REGULARIZATION', 'SHIFT_CHANGE', 'OTHER'];

const REQUEST_TYPE_ICONS = {
  SICK_LEAVE: '🏖️',
  WFH: '🏠',
  REGULARIZATION: '📝',
  SHIFT_CHANGE: '🔄',
  OTHER: '📋',
};

const AttendanceRequestApprovals = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  // Filter states - Pending Requests
  const [pendingProjectFilter, setPendingProjectFilter] = useState('All Projects');
  const [pendingTypeFilter, setPendingTypeFilter] = useState('All');
  const [pendingDateFrom, setPendingDateFrom] = useState(null);
  const [pendingDateTo, setPendingDateTo] = useState(null);
  
  // Filter states - Approval History
  const [historyDecisionFilter, setHistoryDecisionFilter] = useState('All');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('All');
  const [historyDateFrom, setHistoryDateFrom] = useState(null);
  const [historyDateTo, setHistoryDateTo] = useState(null);
  
  // Manage Approvals states
  const [crudAction, setCrudAction] = useState('Update Approval');
  const [updateApprovalId, setUpdateApprovalId] = useState('');
  const [updateDecision, setUpdateDecision] = useState('APPROVED');
  const [updateComment, setUpdateComment] = useState('');
  const [deleteApprovalId, setDeleteApprovalId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  // Dialog states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

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
      const [projectsData, pendingData, allRequestsData, historyData, usersData] = await Promise.all([
        getAllProjects(),
        getPendingAttendanceRequests(),
        getAllAttendanceRequests(),
        getApprovalHistory({ limit: 100 }),
        authenticatedRequest('GET', '/admin/users/', { limit: 1000 }),
      ]);
      
      setProjects(projectsData);
      setPendingRequests(pendingData);
      setAllRequests(allRequestsData);
      setApprovalHistory(historyData);
      setAllUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMessage = error?.message || 'Failed to load data. Please try again.';
      toast.error('❌ Failed to load data', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
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

  // Calculate today's metrics
  const todayMetrics = useMemo(() => {
    const today = startOfToday();
    let approvalsToday = 0;
    let rejectionsToday = 0;

    approvalHistory.forEach(approval => {
      try {
        const decidedAt = approval.decided_at;
        if (decidedAt) {
          const decidedDate = parseISO(decidedAt);
          if (format(decidedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
            if (approval.decision === 'APPROVED') {
              approvalsToday++;
            } else if (approval.decision === 'REJECTED') {
              rejectionsToday++;
            }
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });

    return { approvalsToday, rejectionsToday };
  }, [approvalHistory]);

  // Filter pending requests
  const filteredPendingRequests = useMemo(() => {
    let filtered = [...pendingRequests];

    if (pendingTypeFilter !== 'All') {
      filtered = filtered.filter(r => r.request_type === pendingTypeFilter);
    }

    if (pendingProjectFilter !== 'All Projects') {
      const selectedProject = projects.find(p => p.name === pendingProjectFilter);
      if (selectedProject) {
        filtered = filtered.filter(r => r.project_id === String(selectedProject.id));
      }
    }

    if (pendingDateFrom) {
      filtered = filtered.filter(r => r.start_date >= format(pendingDateFrom, 'yyyy-MM-dd'));
    }

    if (pendingDateTo) {
      filtered = filtered.filter(r => r.end_date <= format(pendingDateTo, 'yyyy-MM-dd'));
    }

    return filtered;
  }, [pendingRequests, pendingTypeFilter, pendingProjectFilter, pendingDateFrom, pendingDateTo, projects]);

  // Filter approval history
  const filteredHistory = useMemo(() => {
    let filtered = [...approvalHistory];

    if (historyDecisionFilter !== 'All') {
      filtered = filtered.filter(h => h.decision === historyDecisionFilter);
    }

    if (historyDateFrom) {
      filtered = filtered.filter(h => {
        try {
          const decidedAt = parseISO(h.decided_at);
          return format(decidedAt, 'yyyy-MM-dd') >= format(historyDateFrom, 'yyyy-MM-dd');
        } catch {
          return false;
        }
      });
    }

    if (historyDateTo) {
      filtered = filtered.filter(h => {
        try {
          const decidedAt = parseISO(h.decided_at);
          return format(decidedAt, 'yyyy-MM-dd') <= format(historyDateTo, 'yyyy-MM-dd');
        } catch {
          return false;
        }
      });
    }

    // Create lookup for request info
    const requestLookup = {};
    allRequests.forEach(req => {
      requestLookup[req.id] = {
        user_name: req.user_name || 'Unknown',
        user_id: req.user_id,
        request_type: req.request_type,
        reason: req.reason,
        start_date: req.start_date,
        end_date: req.end_date,
      };
    });

    // Create lookup for approver names
    const approverLookup = {};
    allUsers.forEach(user => {
      if (user.id) {
        approverLookup[String(user.id)] = user.name || 'Unknown';
      }
    });

    // Enrich history with request info
    const enriched = filtered.map(h => {
      const reqId = h.request_id;
      const reqInfo = requestLookup[reqId] || {};
      
      // Filter by request type
      if (historyTypeFilter !== 'All' && reqInfo.request_type !== historyTypeFilter) {
        return null;
      }

      const approverUserId = h.approver_user_id;
      const approverName = approverLookup[String(approverUserId)] || 'Unknown';

      return {
        decision: h.decision,
        user_name: reqInfo.user_name || 'Unknown',
        user_id: reqInfo.user_id ? String(reqInfo.user_id).substring(0, 8) + '...' : 'N/A',
        request_type: reqInfo.request_type || 'N/A',
        start_date: reqInfo.start_date || 'N/A',
        end_date: reqInfo.end_date || 'N/A',
        approver_name: approverName,
        comment: h.comment || '',
        decided_at: h.decided_at ? h.decided_at.substring(0, 19) : '',
        approval_id: h.id ? String(h.id).substring(0, 8) + '...' : '',
      };
    }).filter(Boolean);

    return enriched;
  }, [approvalHistory, historyDecisionFilter, historyTypeFilter, historyDateFrom, historyDateTo, allRequests, allUsers]);

  // Handle approve
  const handleApprove = async (requestId) => {
    try {
      await submitApproval(requestId, 'APPROVED', 'Approved');
      toast.success('✅ Request approved successfully!', {
        description: 'The attendance request has been approved.',
      });
      await fetchAllData();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to approve request. Please try again.';
      toast.error('❌ Failed to approve request', {
        description: errorMessage,
      });
    }
  };

  // Handle reject
  const handleReject = async (requestId, reason) => {
    if (!reason || reason.trim() === '') {
      toast.warning('⚠️ Rejection reason required', {
        description: 'Please provide a reason for rejecting this request.',
      });
      return;
    }
    try {
      await submitApproval(requestId, 'REJECTED', reason || 'Rejected');
      toast.success('✅ Request rejected', {
        description: 'The attendance request has been rejected.',
      });
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedRequestId(null);
      await fetchAllData();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to reject request. Please try again.';
      toast.error('❌ Failed to reject request', {
        description: errorMessage,
      });
    }
  };

  // Handle update approval
  const handleUpdateApproval = async () => {
    if (!updateApprovalId || updateApprovalId.trim() === '') {
      toast.warning('⚠️ Approval ID required', {
        description: 'Please enter an Approval ID to update.',
      });
      return;
    }
    try {
      await updateApproval(updateApprovalId, updateDecision, updateComment);
      toast.success('✅ Approval updated successfully!', {
        description: 'The approval record has been updated.',
      });
      setUpdateApprovalId('');
      setUpdateComment('');
      setUpdateDecision('APPROVED');
      await fetchAllData();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to update approval. Please try again.';
      toast.error('❌ Failed to update approval', {
        description: errorMessage,
      });
    }
  };

  // Handle delete approval
  const handleDeleteApproval = async () => {
    if (!deleteApprovalId || deleteApprovalId.trim() === '') {
      toast.warning('⚠️ Approval ID required', {
        description: 'Please enter an Approval ID to delete.',
      });
      return;
    }
    if (!deleteConfirm) {
      toast.warning('⚠️ Confirmation required', {
        description: 'Please confirm that you want to delete this record.',
      });
      return;
    }
    try {
      await deleteApproval(deleteApprovalId);
      toast.success('✅ Approval deleted successfully!', {
        description: 'The approval record has been deleted.',
      });
      setDeleteApprovalId('');
      setDeleteConfirm(false);
      await fetchAllData();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to delete approval. Please try again.';
      toast.error('❌ Failed to delete approval', {
        description: errorMessage,
      });
    }
  };

  // Export to CSV
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.warning('⚠️ No data to export', {
        description: 'There is no data available to export.',
      });
      return;
    }

    try {
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('✅ CSV exported successfully', {
        description: `File: ${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`,
      });
    } catch (error) {
      toast.error('❌ Failed to export CSV', {
        description: 'An error occurred while exporting the data.',
      });
    }
  };

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

  // KPI items for metrics
  const metricsItems = [
    {
      id: 'approvals-today',
      title: 'Approvals Today',
      value: todayMetrics.approvalsToday.toString(),
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: 'Requests approved today',
    },
    {
      id: 'rejections-today',
      title: 'Rejections Today',
      value: todayMetrics.rejectionsToday.toString(),
      icon: <XCircle className="h-4 w-4" />,
      description: 'Requests rejected today',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-8 w-8" />
            Attendance Request Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and approve attendance requests from team members
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

      {/* Today's Metrics */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Info className="h-6 w-6" />
          Today's Metrics
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <HoverEffect items={metricsItems} className="grid-cols-1 sm:grid-cols-2" />
        )}
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Pending Requests
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Approval History
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Manage Approvals
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Requests */}
        <TabsContent value="pending" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Pending Attendance Requests</h2>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={pendingProjectFilter} onValueChange={setPendingProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Projects">All Projects</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.name}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Request Type</Label>
                <Select value={pendingTypeFilter} onValueChange={setPendingTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Request Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    {REQUEST_TYPE_OPTIONS.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pendingDateFrom ? format(pendingDateFrom, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pendingDateFrom}
                      onSelect={setPendingDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pendingDateTo ? format(pendingDateTo, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pendingDateTo}
                      onSelect={setPendingDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPendingRequests.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  🎉 All caught up! No pending requests to approve.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{filteredPendingRequests.length}</strong> requests waiting for your review
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {filteredPendingRequests.map(req => (
                    <Card key={req.id} className="border-2">
                      <CardHeader>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {/* User Info */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5" />
                              <CardTitle className="text-lg">{req.user_name || 'Unknown'}</CardTitle>
                            </div>
                            <CardDescription>
                              User ID: <code className="text-xs">{String(req.user_id || 'N/A').substring(0, 8)}...</code>
                            </CardDescription>
                            {req.user_email && (
                              <CardDescription className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {req.user_email}
                              </CardDescription>
                            )}
                          </div>

                          {/* Request Info */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{REQUEST_TYPE_ICONS[req.request_type] || '📋'}</span>
                              <Badge variant="outline">{req.request_type}</Badge>
                            </div>
                            <CardDescription>
                              Request ID: <code className="text-xs">{String(req.id || 'N/A').substring(0, 8)}...</code>
                            </CardDescription>
                            {req.reason && (
                              <CardDescription className="text-sm">
                                <strong>Reason:</strong> {req.reason}
                              </CardDescription>
                            )}
                          </div>

                          {/* Dates */}
                          <div className="space-y-2">
                            <div>
                              <CardDescription className="text-xs mb-1">Start Date</CardDescription>
                              <div className="font-semibold">{req.start_date || 'N/A'}</div>
                            </div>
                            <div>
                              <CardDescription className="text-xs mb-1">End Date</CardDescription>
                              <div className="font-semibold">{req.end_date || 'N/A'}</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => handleApprove(req.id)}
                              className="w-full"
                              variant="default"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Dialog open={rejectDialogOpen && selectedRequestId === req.id} onOpenChange={(open) => {
                              setRejectDialogOpen(open);
                              if (!open) {
                                setSelectedRequestId(null);
                                setRejectReason('');
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => {
                                    setSelectedRequestId(req.id);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Request</DialogTitle>
                                  <DialogDescription>
                                    Please provide a reason for rejecting this request.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Rejection Reason</Label>
                                    <Textarea
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      placeholder="Enter rejection reason..."
                                    />
                                  </div>
                                  <Button
                                    onClick={() => handleReject(req.id, rejectReason)}
                                    variant="destructive"
                                    className="w-full"
                                  >
                                    Confirm Reject
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Approval History */}
        <TabsContent value="history" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Approval History</h2>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={historyDecisionFilter} onValueChange={setHistoryDecisionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="APPROVED">APPROVED</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Request Type</Label>
                <Select value={historyTypeFilter} onValueChange={setHistoryTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Request Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    {REQUEST_TYPE_OPTIONS.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {historyDateFrom ? format(historyDateFrom, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={historyDateFrom}
                      onSelect={setHistoryDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {historyDateTo ? format(historyDateTo, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={historyDateTo}
                      onSelect={setHistoryDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : filteredHistory.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No approval history found.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-md border overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 border-b">
                      <TableRow>
                        <TableHead className="min-w-[100px] whitespace-nowrap">Decision</TableHead>
                        <TableHead className="min-w-[150px] whitespace-nowrap">Requester Name</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">User ID</TableHead>
                        <TableHead className="min-w-[120px] whitespace-nowrap">Request Type</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">From Date</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">To Date</TableHead>
                        <TableHead className="min-w-[150px] whitespace-nowrap">Approved By</TableHead>
                        <TableHead className="min-w-[200px] whitespace-nowrap">Comment</TableHead>
                        <TableHead className="min-w-[150px] whitespace-nowrap">Decided At</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">Approval ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={
                                row.decision === 'APPROVED'
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }
                            >
                              {row.decision}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{row.user_name}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{row.user_id}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.request_type}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.start_date}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.end_date}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.approver_name}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.comment || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.decided_at}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{row.approval_id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredHistory.length} records
                  </p>
                  <Button
                    onClick={() => exportToCSV(filteredHistory, 'approval_history')}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Manage Approvals */}
        <TabsContent value="manage" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Manage Approval Records</h2>
            
            <div className="flex gap-4 mb-6">
              <Button
                variant={crudAction === 'Update Approval' ? 'default' : 'outline'}
                onClick={() => setCrudAction('Update Approval')}
              >
                <Edit className="h-4 w-4 mr-2" />
                Update Approval
              </Button>
              <Button
                variant={crudAction === 'Delete Approval' ? 'default' : 'outline'}
                onClick={() => setCrudAction('Delete Approval')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Approval
              </Button>
            </div>

            {crudAction === 'Update Approval' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Update an existing approval record</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="update-approval-id">Approval ID (UUID)</Label>
                    <Input
                      id="update-approval-id"
                      value={updateApprovalId}
                      onChange={(e) => setUpdateApprovalId(e.target.value)}
                      placeholder="Enter approval ID..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="update-decision">New Decision</Label>
                    <Select value={updateDecision} onValueChange={setUpdateDecision}>
                      <SelectTrigger id="update-decision">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVED">APPROVED</SelectItem>
                        <SelectItem value="REJECTED">REJECTED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="update-comment">New Comment</Label>
                    <Textarea
                      id="update-comment"
                      value={updateComment}
                      onChange={(e) => setUpdateComment(e.target.value)}
                      placeholder="Enter comment..."
                    />
                  </div>
                  <Button onClick={handleUpdateApproval} className="w-full">
                    Update Approval
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Delete an approval record</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      ⚠️ This action cannot be undone!
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="delete-approval-id">Approval ID to delete (UUID)</Label>
                    <Input
                      id="delete-approval-id"
                      value={deleteApprovalId}
                      onChange={(e) => setDeleteApprovalId(e.target.value)}
                      placeholder="Enter approval ID..."
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="delete-confirm"
                      checked={deleteConfirm}
                      onCheckedChange={(checked) => setDeleteConfirm(checked)}
                    />
                    <Label htmlFor="delete-confirm" className="cursor-pointer">
                      I confirm I want to delete this record
                    </Label>
                  </div>
                  <Button
                    onClick={handleDeleteApproval}
                    variant="destructive"
                    className="w-full"
                  >
                    Delete Approval
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendanceRequestApprovals;
