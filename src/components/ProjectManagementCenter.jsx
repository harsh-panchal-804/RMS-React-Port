import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  getAllProjects,
  getAllUsers,
  createProject,
  updateProject,
  bulkUploadProjects,
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  submitQualityAssessment,
  getQualityRatings,
  bulkUploadQuality,
  getUserNameMapping,
  getUserEmailMapping,
  getProjectNameMapping,
} from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Settings,
  Plus,
  Upload,
  Download,
  FileText,
  Calendar as CalendarIcon,
  User,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Info,
  RefreshCw,
  XCircle,
  Trash2,
  Edit,
  Star,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const ROLE_OPTIONS = ['ANNOTATION', 'QC', 'LIVE_QC', 'RETRO_QC', 'PM', 'APM', 'RPM'];

const ProjectManagementCenter = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  
  // Tab 1: Manage Projects states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState(new Date());
  const [newProjectEndDate, setNewProjectEndDate] = useState(null);
  const [newProjectIsActive, setNewProjectIsActive] = useState(true);
  const [createDatePickerOpen, setCreateDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [editedProjects, setEditedProjects] = useState({});
  
  // Tab 2: Team Allocations states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberWorkRole, setAddMemberWorkRole] = useState('ANNOTATION');
  const [addMemberFromDate, setAddMemberFromDate] = useState(new Date());
  const [addMemberToDate, setAddMemberToDate] = useState(null);
  const [addMemberFromPickerOpen, setAddMemberFromPickerOpen] = useState(false);
  const [addMemberToPickerOpen, setAddMemberToPickerOpen] = useState(false);
  const [editMemberUserId, setEditMemberUserId] = useState('');
  const [editMemberNewRole, setEditMemberNewRole] = useState('');
  const [removeMemberUserId, setRemoveMemberUserId] = useState('');
  
  // Tab 3: Quality Assessment states (same as standalone page)
  const [qaMode, setQaMode] = useState('Individual Assessment');
  const [qaSelectedUserId, setQaSelectedUserId] = useState('');
  const [qaSelectedProjectId, setQaSelectedProjectId] = useState('');
  const [qaSelectedDate, setQaSelectedDate] = useState(new Date());
  const [qaRating, setQaRating] = useState('GOOD');
  const [qaQualityScore, setQaQualityScore] = useState(7.0);
  const [qaAccuracy, setQaAccuracy] = useState(null);
  const [qaCriticalRate, setQaCriticalRate] = useState(null);
  const [qaNotes, setQaNotes] = useState('');
  const [qaDatePickerOpen, setQaDatePickerOpen] = useState(false);
  const [qaQualityRatings, setQaQualityRatings] = useState([]);
  
  // Bulk upload states
  const [projectsUploadFile, setProjectsUploadFile] = useState(null);
  const [projectsCsvPreview, setProjectsCsvPreview] = useState(null);
  const [qaUploadFile, setQaUploadFile] = useState(null);
  const [qaCsvPreview, setQaCsvPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

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
    fetchAllData();
  }, [token]);

  // Fetch project members when project is selected
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectMembers();
    }
  }, [selectedProjectId]);

  const fetchProjectMembers = async () => {
    if (!selectedProjectId) return;
    
    try {
      const members = await getProjectMembers(selectedProjectId);
      setProjectMembers(members);
    } catch (error) {
      console.error('Error fetching project members:', error);
      toast.error('❌ Failed to load project members', {
        description: error?.message || 'Please try again.',
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAllData();
      if (selectedProjectId) {
        await fetchProjectMembers();
      }
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

  // Tab 1: Create Project
  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !newProjectCode.trim()) {
      toast.warning('⚠️ Missing required fields', {
        description: 'Please enter both project name and code.',
      });
      return;
    }

    try {
      const payload = {
        name: newProjectName.trim(),
        code: newProjectCode.trim(),
        start_date: format(newProjectStartDate, 'yyyy-MM-dd'),
        end_date: newProjectEndDate ? format(newProjectEndDate, 'yyyy-MM-dd') : null,
        is_active: newProjectIsActive,
      };

      await createProject(payload);
      toast.success('✅ Project created successfully!', {
        description: `${newProjectName} has been created.`,
      });
      
      // Reset form
      setNewProjectName('');
      setNewProjectCode('');
      setNewProjectStartDate(new Date());
      setNewProjectEndDate(null);
      setNewProjectIsActive(true);
      setShowCreateForm(false);
      
      // Refresh data
      await fetchAllData();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to create project. Please try again.';
      toast.error('❌ Failed to create project', {
        description: errorMessage,
      });
    }
  };

  // Tab 1: Update Projects
  const handleUpdateProjects = async () => {
    const changes = Object.keys(editedProjects);
    if (changes.length === 0) {
      toast.warning('⚠️ No changes to save', {
        description: 'Please make changes to projects before saving.',
      });
      return;
    }

    try {
      for (const projectId of changes) {
        const updates = editedProjects[projectId];
        const project = projects.find(p => p.id === projectId);
        if (!project) continue;

        const endDate = updates.end_date || project.end_date;
        const status = updates.status || (endDate ? 'COMPLETED' : (project.is_active ? 'ACTIVE' : 'PAUSED'));

        let finalEndDate = endDate;
        if (status === 'COMPLETED' && !finalEndDate) {
          finalEndDate = format(new Date(), 'yyyy-MM-dd');
        }
        if (status !== 'COMPLETED') {
          finalEndDate = null;
        }

        const payload = {
          name: updates.name || project.name,
          code: updates.code || project.code,
          is_active: status === 'ACTIVE',
          start_date: format(updates.start_date ? new Date(updates.start_date) : new Date(project.start_date), 'yyyy-MM-dd'),
          end_date: finalEndDate,
        };

        await updateProject(projectId, payload);
      }

      toast.success('✅ Projects updated successfully!', {
        description: `${changes.length} project(s) updated.`,
      });
      
      setEditedProjects({});
      await fetchAllData();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to update projects. Please try again.';
      toast.error('❌ Failed to update projects', {
        description: errorMessage,
      });
    }
  };

  // Tab 1: Bulk Upload Projects
  const handleProjectsFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload a CSV file.',
      });
      return;
    }

    setProjectsUploadFile(file);
    
    // Preview CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const preview = lines.slice(1, 11).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, idx) => {
            obj[header.trim()] = values[idx]?.trim() || '';
            return obj;
          }, {});
        });
        setProjectsCsvPreview(preview);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('❌ Error reading CSV file', {
          description: 'Please check the file format.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUploadProjects = async () => {
    if (!projectsUploadFile) {
      toast.warning('⚠️ No file selected', {
        description: 'Please select a CSV file to upload.',
      });
      return;
    }

    setUploading(true);
    try {
      const result = await bulkUploadProjects(projectsUploadFile);
      
      const inserted = result?.inserted || 0;
      const errors = result?.errors || [];
      
      if (inserted > 0) {
        toast.success(`✅ Successfully uploaded ${inserted} project(s)!`, {
          description: errors.length > 0 ? `${errors.length} errors encountered.` : '',
        });
      }
      
      if (errors.length > 0) {
        toast.warning(`⚠️ ${errors.length} errors encountered`, {
          description: 'Check the console for details.',
        });
        console.error('Upload errors:', errors);
      }
      
      // Reset
      setProjectsUploadFile(null);
      setProjectsCsvPreview(null);
      const fileInput = document.getElementById('projects-csv-upload');
      if (fileInput) fileInput.value = '';
      
      await fetchAllData();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to upload projects. Please try again.';
      toast.error('❌ Upload failed', {
        description: errorMessage,
      });
    } finally {
      setUploading(false);
    }
  };

  // Tab 2: Add Member
  const handleAddMember = async () => {
    if (!addMemberUserId) {
      toast.warning('⚠️ Missing required fields', {
        description: 'Please select a user.',
      });
      return;
    }

    try {
      const payload = {
        user_id: addMemberUserId,
        work_role: addMemberWorkRole,
        assigned_from: format(addMemberFromDate, 'yyyy-MM-dd'),
        assigned_to: addMemberToDate ? format(addMemberToDate, 'yyyy-MM-dd') : null,
      };

      await addProjectMember(selectedProjectId, payload);
      toast.success('✅ Member added successfully!', {
        description: 'The member has been added to the project.',
      });
      
      // Reset form
      setAddMemberUserId('');
      setAddMemberWorkRole('ANNOTATION');
      setAddMemberFromDate(new Date());
      setAddMemberToDate(null);
      setShowAddMemberForm(false);
      
      // Refresh members
      await fetchProjectMembers();
      await fetchAllData(); // Refresh projects to update member counts
    } catch (error) {
      const errorMessage = error?.message || 'Failed to add member. Please try again.';
      toast.error('❌ Failed to add member', {
        description: errorMessage,
      });
    }
  };

  // Tab 2: Update Member Role
  const handleUpdateMemberRole = async () => {
    if (!editMemberUserId || !editMemberNewRole) {
      toast.warning('⚠️ Missing required fields', {
        description: 'Please select a member and new role.',
      });
      return;
    }

    try {
      const payload = {
        work_role: editMemberNewRole,
      };

      await updateProjectMemberRole(selectedProjectId, editMemberUserId, payload);
      toast.success('✅ Member role updated successfully!', {
        description: 'The member role has been updated.',
      });
      
      // Reset
      setEditMemberUserId('');
      setEditMemberNewRole('');
      
      // Refresh members
      await fetchProjectMembers();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to update member role. Please try again.';
      toast.error('❌ Failed to update member role', {
        description: errorMessage,
      });
    }
  };

  // Tab 2: Remove Member
  const handleRemoveMember = async () => {
    if (!removeMemberUserId) {
      toast.warning('⚠️ Missing required fields', {
        description: 'Please select a member to remove.',
      });
      return;
    }

    try {
      await removeProjectMember(selectedProjectId, removeMemberUserId);
      toast.success('✅ Member removed successfully!', {
        description: 'The member has been removed from the project.',
      });
      
      // Reset
      setRemoveMemberUserId('');
      
      // Refresh members
      await fetchProjectMembers();
      await fetchAllData(); // Refresh projects to update member counts
    } catch (error) {
      const errorMessage = error?.message || 'Failed to remove member. Please try again.';
      toast.error('❌ Failed to remove member', {
        description: errorMessage,
      });
    }
  };

  // Tab 3: Quality Assessment (same as standalone)
  useEffect(() => {
    if (qaMode === 'Individual Assessment' && qaSelectedUserId && qaSelectedProjectId) {
      fetchQaQualityRatings();
    }
  }, [qaSelectedUserId, qaSelectedProjectId, qaSelectedDate, qaMode]);

  const fetchQaQualityRatings = async () => {
    if (!qaSelectedUserId || !qaSelectedProjectId) return;
    
    try {
      const startDate = format(new Date(qaSelectedDate.getTime() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const endDate = format(new Date(qaSelectedDate.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      
      const ratings = await getQualityRatings({
        user_id: qaSelectedUserId,
        project_id: qaSelectedProjectId,
        start_date: startDate,
        end_date: endDate,
      });
      
      setQaQualityRatings(ratings);
    } catch (error) {
      console.error('Error fetching quality ratings:', error);
    }
  };

  const handleQaSubmitAssessment = async () => {
    if (!qaSelectedUserId || !qaSelectedProjectId) {
      toast.warning('⚠️ Missing required fields', {
        description: 'Please select both user and project.',
      });
      return;
    }

    try {
      const payload = {
        user_id: qaSelectedUserId,
        project_id: qaSelectedProjectId,
        metric_date: format(qaSelectedDate, 'yyyy-MM-dd'),
        rating: qaRating,
        quality_score: qaQualityScore ? parseFloat(qaQualityScore) : null,
        accuracy: qaAccuracy !== null ? parseFloat(qaAccuracy) : null,
        critical_rate: qaCriticalRate !== null ? parseFloat(qaCriticalRate) : null,
        notes: qaNotes.trim() || null,
      };

      await submitQualityAssessment(payload);
      toast.success('✅ Quality assessment saved successfully!', {
        description: 'The assessment has been recorded.',
      });
      
      // Reset form
      setQaQualityScore(7.0);
      setQaAccuracy(null);
      setQaCriticalRate(null);
      setQaNotes('');
      
      // Refresh data
      await fetchQaQualityRatings();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to save quality assessment. Please try again.';
      toast.error('❌ Failed to save assessment', {
        description: errorMessage,
      });
    }
  };

  const handleQaFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload a CSV file.',
      });
      return;
    }

    setQaUploadFile(file);
    
    // Preview CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const preview = lines.slice(1, 11).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, idx) => {
            obj[header.trim()] = values[idx]?.trim() || '';
            return obj;
          }, {});
        });
        setQaCsvPreview(preview);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('❌ Error reading CSV file', {
          description: 'Please check the file format.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleQaBulkUpload = async () => {
    if (!qaUploadFile) {
      toast.warning('⚠️ No file selected', {
        description: 'Please select a CSV file to upload.',
      });
      return;
    }

    setUploading(true);
    try {
      const result = await bulkUploadQuality(qaUploadFile);
      
      const inserted = result?.inserted || 0;
      const errors = result?.errors || [];
      
      if (inserted > 0) {
        toast.success(`✅ Successfully uploaded ${inserted} quality assessments!`, {
          description: errors.length > 0 ? `${errors.length} errors encountered.` : '',
        });
      }
      
      if (errors.length > 0) {
        toast.warning(`⚠️ ${errors.length} errors encountered`, {
          description: 'Check the console for details.',
        });
        console.error('Upload errors:', errors);
      }
      
      // Reset
      setQaUploadFile(null);
      setQaCsvPreview(null);
      const fileInput = document.getElementById('qa-csv-upload');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      const errorMessage = error?.message || 'Failed to upload quality assessments. Please try again.';
      toast.error('❌ Upload failed', {
        description: errorMessage,
      });
    } finally {
      setUploading(false);
    }
  };

  // Download CSV templates
  const downloadProjectsTemplate = () => {
    const csv = 'code,name,is_active,start_date,end_date\nPROJ001,Project Name,true,2024-01-15,2024-12-31\nPROJ002,Another Project,true,2024-06-01,2024-12-31';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadQaTemplate = () => {
    const csv = 'user_email,project_code,metric_date,rating,quality_score,accuracy,critical_rate,work_role,notes\nuser@example.com,PROJ001,2024-01-15,GOOD,8.5,95.0,88.5,,Example quality assessment';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quality_assessment_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Format quality rating
  const formatRating = (rating) => {
    const ratingMap = {
      'GOOD': { label: 'Good', icon: '✅', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
      'AVERAGE': { label: 'Average', icon: '⚠️', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      'BAD': { label: 'Bad', icon: '❌', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
    };
    return ratingMap[rating] || { label: rating, icon: '', color: '' };
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

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase()) && !p.code.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      
      const hasEndDate = !!p.end_date;
      const isActive = p.is_active;
      
      if (statusFilter === 'ACTIVE' && (!isActive || hasEndDate)) return false;
      if (statusFilter === 'PAUSED' && (isActive || hasEndDate)) return false;
      if (statusFilter === 'COMPLETED' && !hasEndDate) return false;
      
      return true;
    });
  }, [projects, searchText, statusFilter]);

  // Calculate project KPIs
  const projectKPIs = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.is_active && !p.end_date).length;
    const paused = projects.filter(p => !p.is_active && !p.end_date).length;
    const completed = projects.filter(p => !!p.end_date).length;
    return { total, active, paused, completed };
  }, [projects]);

  // Get available users for adding members (exclude already assigned)
  const availableUsers = useMemo(() => {
    if (!selectedProjectId || !projectMembers.length) return users.filter(u => u.is_active);
    const assignedUserIds = new Set(projectMembers.map(m => String(m.user_id)));
    return users.filter(u => u.is_active && !assignedUserIds.has(String(u.id)));
  }, [users, projectMembers, selectedProjectId]);

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

  // QA User options
  const qaUserOptions = useMemo(() => {
    return userOptions;
  }, [userOptions]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Project Management Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage projects, team allocations, and quality assessments
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

      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects">📂 Manage Projects</TabsTrigger>
          <TabsTrigger value="allocations">👥 Team Allocations</TabsTrigger>
          <TabsTrigger value="quality">⭐ Quality Assessment</TabsTrigger>
        </TabsList>

        {/* TAB 1: Manage Projects */}
        <TabsContent value="projects" className="space-y-6">
          {/* Create Project Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Code</Label>
                  <Input
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    placeholder="Enter project code"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover open={createDatePickerOpen} onOpenChange={setCreateDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newProjectStartDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newProjectStartDate}
                        onSelect={(date) => {
                          if (date) {
                            setNewProjectStartDate(date);
                            setCreateDatePickerOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newProjectEndDate ? format(newProjectEndDate, 'PPP') : 'No end date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newProjectEndDate}
                        onSelect={(date) => {
                          setNewProjectEndDate(date);
                          setEndDatePickerOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is-active"
                      checked={newProjectIsActive}
                      onCheckedChange={setNewProjectIsActive}
                    />
                    <Label htmlFor="is-active" className="cursor-pointer">Is Active?</Label>
                  </div>
                </div>
              </div>
              <Button onClick={handleCreateProject} className="w-full">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>

          {/* Bulk Upload Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Bulk Projects (CSV)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>CSV Format:</strong> code, name, is_active, start_date, end_date
                  <br />
                  Dates must be in YYYY-MM-DD format (e.g., 2024-01-15)
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadProjectsTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Input
                  id="projects-csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleProjectsFileUpload}
                  className="flex-1"
                />
              </div>
              {projectsCsvPreview && projectsCsvPreview.length > 0 && (
                <div className="space-y-2">
                  <Label>CSV Preview (First 10 rows)</Label>
                  <div className="rounded-md border overflow-auto max-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(projectsCsvPreview[0]).map(key => (
                            <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectsCsvPreview.map((row, idx) => (
                          <TableRow key={idx}>
                            {Object.values(row).map((value, vIdx) => (
                              <TableCell key={vIdx} className="whitespace-nowrap">
                                {String(value)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              <Button
                onClick={handleBulkUploadProjects}
                disabled={!projectsUploadFile || uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Projects
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectKPIs.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectKPIs.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Paused Projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectKPIs.paused}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completed Projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectKPIs.completed}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Search by Code or Name</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search projects..."
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="PAUSED">PAUSED</SelectItem>
                  <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Projects Table */}
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : filteredProjects.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>No projects found.</AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>Edit projects and save changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="min-w-[100px] whitespace-nowrap">Code</TableHead>
                        <TableHead className="min-w-[200px] whitespace-nowrap">Name</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">Status</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">Start Date</TableHead>
                        <TableHead className="min-w-[100px] whitespace-nowrap">End Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.map((project) => {
                        const projectEdits = editedProjects[project.id] || {};
                        const status = project.end_date ? 'COMPLETED' : (project.is_active ? 'ACTIVE' : 'PAUSED');
                        const displayStatus = projectEdits.status || status;
                        
                        return (
                          <TableRow key={project.id} className="hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap">
                              <Input
                                value={projectEdits.code || project.code}
                                onChange={(e) => {
                                  setEditedProjects({
                                    ...editedProjects,
                                    [project.id]: { ...projectEdits, code: e.target.value },
                                  });
                                }}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Input
                                value={projectEdits.name || project.name}
                                onChange={(e) => {
                                  setEditedProjects({
                                    ...editedProjects,
                                    [project.id]: { ...projectEdits, name: e.target.value },
                                  });
                                }}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Select
                                value={displayStatus}
                                onValueChange={(value) => {
                                  setEditedProjects({
                                    ...editedProjects,
                                    [project.id]: { ...projectEdits, status: value },
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                                  <SelectItem value="PAUSED">PAUSED</SelectItem>
                                  <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Input
                                type="date"
                                value={projectEdits.start_date || format(parseISO(project.start_date), 'yyyy-MM-dd')}
                                onChange={(e) => {
                                  setEditedProjects({
                                    ...editedProjects,
                                    [project.id]: { ...projectEdits, start_date: e.target.value },
                                  });
                                }}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Input
                                type="date"
                                value={projectEdits.end_date || (project.end_date ? format(parseISO(project.end_date), 'yyyy-MM-dd') : '')}
                                onChange={(e) => {
                                  setEditedProjects({
                                    ...editedProjects,
                                    [project.id]: { ...projectEdits, end_date: e.target.value || null },
                                  });
                                }}
                                className="h-8"
                                placeholder="No end date"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleUpdateProjects} disabled={Object.keys(editedProjects).length === 0}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: Team Allocations */}
        <TabsContent value="allocations" className="space-y-6">
          {/* Project Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Project</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedProjectId}
                onValueChange={(value) => {
                  setSelectedProjectId(value);
                  const project = projects.find(p => p.id === value);
                  setSelectedProjectName(project?.name || '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedProjectId && (
            <>
              {/* Add Member Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Add Member to Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Select User</Label>
                      <Select value={addMemberUserId} onValueChange={setAddMemberUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.email ? `${user.name} (${user.email})` : user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Work Role</Label>
                      <Select value={addMemberWorkRole} onValueChange={setAddMemberWorkRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Assigned From</Label>
                      <Popover open={addMemberFromPickerOpen} onOpenChange={setAddMemberFromPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(addMemberFromDate, 'PPP')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={addMemberFromDate}
                            onSelect={(date) => {
                              if (date) {
                                setAddMemberFromDate(date);
                                setAddMemberFromPickerOpen(false);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned To (Optional)</Label>
                      <Popover open={addMemberToPickerOpen} onOpenChange={setAddMemberToPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {addMemberToDate ? format(addMemberToDate, 'PPP') : 'No end date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={addMemberToDate}
                            onSelect={(date) => {
                              setAddMemberToDate(date);
                              setAddMemberToPickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <Button onClick={handleAddMember} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </CardContent>
              </Card>

              {/* Current Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Current Team Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : projectMembers.length === 0 ? (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No members assigned to this project yet. Use the 'Add Member' form above to assign team members.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="rounded-md border overflow-auto max-h-[400px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                              <TableHead className="whitespace-nowrap">Name</TableHead>
                              <TableHead className="whitespace-nowrap">Email</TableHead>
                              <TableHead className="whitespace-nowrap">Work Role</TableHead>
                              <TableHead className="whitespace-nowrap">Assigned From</TableHead>
                              <TableHead className="whitespace-nowrap">Assigned To</TableHead>
                              <TableHead className="whitespace-nowrap">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projectMembers.map((member) => (
                              <TableRow key={member.user_id} className="hover:bg-muted/50">
                                <TableCell className="whitespace-nowrap">{member.name || '-'}</TableCell>
                                <TableCell className="whitespace-nowrap">{member.email || '-'}</TableCell>
                                <TableCell className="whitespace-nowrap">{member.work_role || '-'}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {member.assigned_from ? format(parseISO(member.assigned_from), 'MMM dd, yyyy') : '-'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {member.assigned_to ? format(parseISO(member.assigned_to), 'MMM dd, yyyy') : 'Ongoing'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge variant={member.is_active ? 'default' : 'secondary'}>
                                    {member.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Edit Member Role */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Edit className="h-5 w-5" />
                          Edit Member Role
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Select Member</Label>
                            <Select value={editMemberUserId} onValueChange={setEditMemberUserId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select member" />
                              </SelectTrigger>
                              <SelectContent>
                                {projectMembers.map(member => (
                                  <SelectItem key={member.user_id} value={member.user_id}>
                                    {member.name} ({member.email || 'No email'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>New Work Role</Label>
                            <Select value={editMemberNewRole} onValueChange={setEditMemberNewRole}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map(role => (
                                  <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 flex items-end">
                            <Button onClick={handleUpdateMemberRole} className="w-full" disabled={!editMemberUserId || !editMemberNewRole}>
                              <Edit className="h-4 w-4 mr-2" />
                              Update Role
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Remove Member */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Trash2 className="h-5 w-5" />
                          Remove Member
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-2 md:col-span-3">
                            <Label>Select Member to Remove</Label>
                            <Select value={removeMemberUserId} onValueChange={setRemoveMemberUserId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select member" />
                              </SelectTrigger>
                              <SelectContent>
                                {projectMembers.map(member => (
                                  <SelectItem key={member.user_id} value={member.user_id}>
                                    {member.name} ({member.email || 'No email'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 flex items-end">
                            <Button onClick={handleRemoveMember} variant="destructive" className="w-full" disabled={!removeMemberUserId}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* TAB 3: Quality Assessment */}
        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Quality Assessment
              </CardTitle>
              <CardDescription>
                Manually assess quality ratings for users on specific dates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={qaMode} onValueChange={setQaMode} className="flex flex-row gap-6 mb-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Individual Assessment" id="qa-individual" />
                  <Label htmlFor="qa-individual" className="cursor-pointer">Individual Assessment</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Bulk Upload" id="qa-bulk" />
                  <Label htmlFor="qa-bulk" className="cursor-pointer">Bulk Upload</Label>
                </div>
              </RadioGroup>

              {qaMode === 'Individual Assessment' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Select User</Label>
                      <Select value={qaSelectedUserId} onValueChange={setQaSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select User" />
                        </SelectTrigger>
                        <SelectContent>
                          {qaUserOptions.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Select Project</Label>
                      <Select value={qaSelectedProjectId} onValueChange={setQaSelectedProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assessment Date</Label>
                      <Popover open={qaDatePickerOpen} onOpenChange={setQaDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(qaSelectedDate, 'PPP')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={qaSelectedDate}
                            onSelect={(date) => {
                              if (date) {
                                setQaSelectedDate(date);
                                setQaDatePickerOpen(false);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quality Rating</Label>
                      <Select value={qaRating} onValueChange={setQaRating}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GOOD">GOOD</SelectItem>
                          <SelectItem value="AVERAGE">AVERAGE</SelectItem>
                          <SelectItem value="BAD">BAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quality Score (0-10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={qaQualityScore}
                        onChange={(e) => setQaQualityScore(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Accuracy (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={qaAccuracy || ''}
                        onChange={(e) => setQaAccuracy(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Critical Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={qaCriticalRate || ''}
                        onChange={(e) => setQaCriticalRate(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Assessment Notes (Optional)</Label>
                    <Textarea
                      value={qaNotes}
                      onChange={(e) => setQaNotes(e.target.value)}
                      placeholder="Add any additional comments about the quality assessment..."
                      rows={4}
                    />
                  </div>

                  <Button onClick={handleQaSubmitAssessment} className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Quality Assessment
                  </Button>

                  {/* Recent Assessments */}
                  {qaSelectedUserId && qaSelectedProjectId && qaQualityRatings.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Recent Quality Assessments</h3>
                      <div className="rounded-md border overflow-auto max-h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Rating</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Accuracy</TableHead>
                              <TableHead>Critical Rate</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {qaQualityRatings.map((rating, idx) => {
                              const ratingInfo = formatRating(rating.quality_rating);
                              return (
                                <TableRow key={idx}>
                                  <TableCell>
                                    {rating.metric_date ? format(parseISO(rating.metric_date), 'MMM dd, yyyy') : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={ratingInfo.color}>
                                      {ratingInfo.icon} {ratingInfo.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {rating.quality_score !== null && rating.quality_score !== undefined
                                      ? `${rating.quality_score.toFixed(1)}`
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {rating.accuracy !== null && rating.accuracy !== undefined
                                      ? `${rating.accuracy.toFixed(1)}%`
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {rating.critical_rate !== null && rating.critical_rate !== undefined
                                      ? `${rating.critical_rate.toFixed(1)}%`
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>{rating.source || 'N/A'}</TableCell>
                                  <TableCell>{rating.notes || '-'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>CSV Format Required:</strong> user_email, project_code, metric_date, rating, quality_score, accuracy, critical_rate, work_role, notes
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={downloadQaTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                    <Input
                      id="qa-csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleQaFileUpload}
                      className="flex-1"
                    />
                  </div>
                  {qaCsvPreview && qaCsvPreview.length > 0 && (
                    <div className="space-y-2">
                      <Label>CSV Preview (First 10 rows)</Label>
                      <div className="rounded-md border overflow-auto max-h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(qaCsvPreview[0]).map(key => (
                                <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {qaCsvPreview.map((row, idx) => (
                              <TableRow key={idx}>
                                {Object.values(row).map((value, vIdx) => (
                                  <TableCell key={vIdx} className="whitespace-nowrap">
                                    {String(value)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleQaBulkUpload}
                    disabled={!qaUploadFile || uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Quality Assessments
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectManagementCenter;
