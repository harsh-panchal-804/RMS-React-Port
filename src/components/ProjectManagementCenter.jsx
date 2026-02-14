import { useState, useEffect, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  getAllProjects,
  getAllUsers,
  authenticatedRequest,
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
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverEffect } from '@/components/ui/card-hover-effect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Settings,
  Plus,
  Upload,
  Download,
  FileText,
  Calendar as CalendarIcon,
  User,
  Users,
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
import { LoaderThreeDemo } from './LoaderDemo';

const ROLE_OPTIONS = ['ANNOTATION', 'QC', 'LIVE_QC', 'RETRO_QC', 'PM', 'APM', 'RPM'];
const USER_ROLE_OPTIONS = ['USER', 'MANAGER', 'ADMIN'];
const WEEKOFF_OPTIONS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const ProjectManagementCenter = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [projectOwnersByProject, setProjectOwnersByProject] = useState({});
  
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
  const [ownerAssignProjectId, setOwnerAssignProjectId] = useState('');
  const [ownerAssignManagerIds, setOwnerAssignManagerIds] = useState([]);
  
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
  const [removeMemberConfirmDrawerOpen, setRemoveMemberConfirmDrawerOpen] = useState(false);
  const [weekoffUpdateUserId, setWeekoffUpdateUserId] = useState('');
  const [weekoffUpdateValues, setWeekoffUpdateValues] = useState([]);
  
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

  // Tab 4: User Management states
  const [userMgmtAction, setUserMgmtAction] = useState('add');
  const [addUserMethod, setAddUserMethod] = useState('single');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('USER');
  const [newUserDoj, setNewUserDoj] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newUserShiftId, setNewUserShiftId] = useState('');
  const [newUserRpmId, setNewUserRpmId] = useState('');
  const [newUserWeekoffs, setNewUserWeekoffs] = useState(['SUNDAY']);
  const [newUserWorkRole, setNewUserWorkRole] = useState('');
  const [newUserSoulId, setNewUserSoulId] = useState('');
  const [newUserQualityRating, setNewUserQualityRating] = useState('');
  const [usersUploadFile, setUsersUploadFile] = useState(null);
  const [usersCsvPreview, setUsersCsvPreview] = useState(null);
  const [usersUploadErrors, setUsersUploadErrors] = useState([]);
  const usersFileInputRef = useRef(null);
  const [userSearchName, setUserSearchName] = useState('');
  const [userSearchEmail, setUserSearchEmail] = useState('');
  const [userSearchActive, setUserSearchActive] = useState('All');
  const [selectedEditUserId, setSelectedEditUserId] = useState('');
  const [editUserForm, setEditUserForm] = useState({
    email: '',
    name: '',
    role: 'USER',
    doj: format(new Date(), 'yyyy-MM-dd'),
    dol: '',
    is_active: true,
    default_shift_id: '',
    rpm_user_id: '',
    weekoffs: ['SUNDAY'],
    work_role: '',
    soul_id: '',
    quality_rating: '',
  });

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
      const [projectsData, usersData, shiftsData, managersData] = await Promise.all([
        getAllProjects(),
        getAllUsers({ limit: 1000 }),
        authenticatedRequest('GET', '/admin/shifts/').catch(() => []),
        authenticatedRequest('GET', '/admin/users/project_managers').catch(() => []),
      ]);
      
      setProjects(projectsData);
      setUsers(usersData);
      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
      setProjectManagers(Array.isArray(managersData) ? managersData : []);

      // Fetch owners for PM/APM assignment parity
      const ownerPairs = await Promise.all(
        (projectsData || []).map(async (project) => {
          try {
            const owners = await authenticatedRequest('GET', `/admin/projects/${project.id}/owners`);
            return [project.id, Array.isArray(owners) ? owners : []];
          } catch {
            return [project.id, []];
          }
        })
      );
      setProjectOwnersByProject(Object.fromEntries(ownerPairs));
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
    let isMounted = true;
    const loadInitialData = async () => {
      await Promise.all([
        fetchAllData(),
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

  const normalizeWeekoffs = (values) => {
    return (values || [])
      .map((value) => {
        if (typeof value === 'string') return value.toUpperCase();
        if (value && typeof value === 'object') return String(value.value || value.name || '').toUpperCase();
        return '';
      })
      .filter(Boolean);
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
  const openRemoveMemberConfirm = () => {
    if (!removeMemberUserId) {
      toast.warning('⚠️ Missing required fields', {
        description: 'Please select a member to remove.',
      });
      return;
    }
    setRemoveMemberConfirmDrawerOpen(true);
  };

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
      setRemoveMemberConfirmDrawerOpen(false);
      
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

  const projectKpiItems = useMemo(() => ([
    {
      id: 'pmc-total-projects',
      title: 'Total Projects',
      value: String(projectKPIs.total),
      icon: <FolderOpen className="h-4 w-4" />,
      description: 'All managed projects',
    },
    {
      id: 'pmc-active-projects',
      title: 'Active Projects',
      value: String(projectKPIs.active),
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: 'Active and ongoing',
    },
    {
      id: 'pmc-paused-projects',
      title: 'Paused Projects',
      value: String(projectKPIs.paused),
      icon: <AlertCircle className="h-4 w-4" />,
      description: 'Temporarily inactive',
    },
    {
      id: 'pmc-completed-projects',
      title: 'Completed Projects',
      value: String(projectKPIs.completed),
      icon: <FileText className="h-4 w-4" />,
      description: 'Closed projects',
    },
  ]), [projectKPIs]);

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

  const managerOptions = useMemo(() => {
    return projectManagers.map((manager) => ({
      id: manager.id,
      label: manager.email ? `${manager.name} (${manager.email})` : manager.name,
      name: manager.name,
      email: manager.email,
    }));
  }, [projectManagers]);

  const shiftOptions = useMemo(() => {
    return shifts.map((shift) => ({
      id: shift.id,
      label: shift.name,
    }));
  }, [shifts]);

  const selectedOwnerProject = useMemo(
    () => projects.find((project) => project.id === ownerAssignProjectId) || null,
    [projects, ownerAssignProjectId]
  );

  const removeMemberDisplayName = useMemo(() => {
    const member = projectMembers.find((m) => String(m.user_id) === String(removeMemberUserId));
    return member ? `${member.name} (${member.email || 'No email'})` : '';
  }, [projectMembers, removeMemberUserId]);

  useEffect(() => {
    if (!ownerAssignProjectId) {
      setOwnerAssignManagerIds([]);
      return;
    }
    const owners = projectOwnersByProject[ownerAssignProjectId] || [];
    const ownerIds = owners
      .map((owner) => owner.user_id || owner.id)
      .filter(Boolean)
      .map(String);
    setOwnerAssignManagerIds(ownerIds);
  }, [ownerAssignProjectId, projectOwnersByProject]);

  useEffect(() => {
    if (!weekoffUpdateUserId) {
      setWeekoffUpdateValues([]);
      return;
    }
    const selectedUser = users.find((u) => String(u.id) === String(weekoffUpdateUserId));
    setWeekoffUpdateValues(normalizeWeekoffs(selectedUser?.weekoffs || ['SUNDAY']));
  }, [weekoffUpdateUserId, users]);

  const handleSaveProjectOwners = async () => {
    if (!ownerAssignProjectId) {
      toast.warning('⚠️ Select a project first');
      return;
    }
    try {
      const response = await authenticatedRequest(
        'PUT',
        `/admin/projects/${ownerAssignProjectId}/owners/bulk`,
        {
          user_ids: ownerAssignManagerIds.map(String),
          work_role: 'PM',
        }
      );
      toast.success('✅ PM/APM assignment saved', {
        description: `Added: ${response?.added || 0}, Removed: ${response?.removed || 0}`,
      });
      await fetchAllData();
    } catch (error) {
      toast.error('❌ Failed to save PM/APM assignment', {
        description: error?.message || 'Please try again.',
      });
    }
  };

  const handleUpdateUserWeekoff = async () => {
    if (!weekoffUpdateUserId) {
      toast.warning('⚠️ Select a user first');
      return;
    }
    if (!weekoffUpdateValues.length) {
      toast.warning('⚠️ Select at least one weekoff day');
      return;
    }
    try {
      await authenticatedRequest('PUT', `/admin/users/${weekoffUpdateUserId}`, {
        weekoffs: weekoffUpdateValues,
      });
      toast.success('✅ Weekoff updated successfully');
      await fetchAllData();
    } catch (error) {
      toast.error('❌ Failed to update weekoff', {
        description: error?.message || 'Please try again.',
      });
    }
  };

  const handleAddSingleUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim()) {
      toast.warning('⚠️ Email and Name are required');
      return;
    }
    try {
      const payload = {
        email: newUserEmail.trim(),
        name: newUserName.trim(),
        role: newUserRole,
        doj: newUserDoj,
        is_active: true,
        weekoffs: newUserWeekoffs.length ? newUserWeekoffs : ['SUNDAY'],
        default_shift_id: newUserShiftId || null,
        rpm_user_id: newUserRpmId || null,
        work_role: newUserWorkRole.trim() || null,
        soul_id: newUserSoulId.trim() || null,
        quality_rating: newUserQualityRating.trim() || null,
      };
      await authenticatedRequest('POST', '/admin/users/', payload);
      toast.success(`✅ User '${newUserName.trim()}' added successfully`);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('USER');
      setNewUserDoj(format(new Date(), 'yyyy-MM-dd'));
      setNewUserShiftId('');
      setNewUserRpmId('');
      setNewUserWeekoffs(['SUNDAY']);
      setNewUserWorkRole('');
      setNewUserSoulId('');
      setNewUserQualityRating('');
      await fetchAllData();
    } catch (error) {
      toast.error('❌ Failed to add user', {
        description: error?.message || 'Please try again.',
      });
    }
  };

  const handleUsersFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload a CSV file.',
      });
      return;
    }

    setUsersUploadFile(file);
    setUsersUploadErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        const lines = text.split('\n').filter((line) => line.trim());
        if (lines.length === 0) {
          setUsersCsvPreview([]);
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim());
        const preview = lines.slice(1, 11).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          return headers.reduce((acc, header, idx) => {
            acc[header] = values[idx] || '';
            return acc;
          }, {});
        });
        setUsersCsvPreview(preview);
      } catch (error) {
        toast.error('❌ Error reading CSV file', {
          description: 'Please check the file format.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUploadUsers = async () => {
    if (!usersUploadFile) {
      toast.warning('⚠️ No file selected');
      return;
    }
    setUploading(true);
    setUsersUploadErrors([]);
    try {
      const csvText = await usersUploadFile.text();
      const lines = csvText.split('\n').filter((line) => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV has no data rows.');
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        return headers.reduce((acc, header, idx) => {
          acc[header] = values[idx] || '';
          return acc;
        }, {});
      });

      const requiredColumns = ['email', 'name', 'role'];
      const missing = requiredColumns.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        throw new Error(`Missing required columns: ${missing.join(', ')}`);
      }

      const shiftNameToId = Object.fromEntries(shiftOptions.map((s) => [s.label, s.id]));
      const managerEmailToId = Object.fromEntries(
        managerOptions.map((m) => [String(m.email || '').trim(), m.id])
      );

      let successCount = 0;
      const errors = [];
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        try {
          const payload = {
            email: String(row.email || '').trim(),
            name: String(row.name || '').trim(),
            role: String(row.role || 'USER').trim().toUpperCase(),
            doj: String(row.doj || format(new Date(), 'yyyy-MM-dd')).trim(),
            is_active: true,
            weekoffs: row.weekoffs
              ? String(row.weekoffs)
                  .split(',')
                  .map((w) => w.trim().toUpperCase())
                  .filter(Boolean)
              : ['SUNDAY'],
            work_role: row.work_role ? String(row.work_role).trim() : null,
            soul_id: row.soul_id ? String(row.soul_id).trim() : null,
            quality_rating: row.quality_rating ? String(row.quality_rating).trim() : null,
          };

          if (row.shift_name && shiftNameToId[row.shift_name]) {
            payload.default_shift_id = shiftNameToId[row.shift_name];
          }
          if (row.rpm_email && managerEmailToId[String(row.rpm_email).trim()]) {
            payload.rpm_user_id = managerEmailToId[String(row.rpm_email).trim()];
          }

          await authenticatedRequest('POST', '/admin/users/', payload);
          successCount += 1;
        } catch (error) {
          errors.push(`Row ${idx + 1} (${row.email || 'unknown'}): ${error?.message || 'Upload failed'}`);
        }
      }

      setUsersUploadErrors(errors);
      if (successCount > 0) {
        toast.success(`✅ Successfully added ${successCount} users`);
      }
      if (errors.length > 0) {
        toast.warning(`⚠️ ${errors.length} rows failed during upload`);
      }
      await fetchAllData();
    } catch (error) {
      toast.error('❌ Bulk upload failed', {
        description: error?.message || 'Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const searchedUsers = useMemo(() => {
    let filtered = [...users];
    if (userSearchName.trim()) {
      const query = userSearchName.trim().toLowerCase();
      filtered = filtered.filter((u) => String(u.name || '').toLowerCase().includes(query));
    }
    if (userSearchEmail.trim()) {
      const query = userSearchEmail.trim().toLowerCase();
      filtered = filtered.filter((u) => String(u.email || '').toLowerCase().includes(query));
    }
    if (userSearchActive === 'Active Only') {
      filtered = filtered.filter((u) => Boolean(u.is_active));
    } else if (userSearchActive === 'Inactive Only') {
      filtered = filtered.filter((u) => !Boolean(u.is_active));
    }
    return filtered;
  }, [users, userSearchName, userSearchEmail, userSearchActive]);

  useEffect(() => {
    if (!selectedEditUserId) return;
    const selectedUser = users.find((u) => String(u.id) === String(selectedEditUserId));
    if (!selectedUser) return;
    setEditUserForm({
      email: selectedUser.email || '',
      name: selectedUser.name || '',
      role: selectedUser.role?.value || selectedUser.role || 'USER',
      doj: selectedUser.doj || format(new Date(), 'yyyy-MM-dd'),
      dol: selectedUser.dol || '',
      is_active: Boolean(selectedUser.is_active),
      default_shift_id: selectedUser.default_shift_id || '',
      rpm_user_id: selectedUser.rpm_user_id || '',
      weekoffs: normalizeWeekoffs(selectedUser.weekoffs || ['SUNDAY']),
      work_role: selectedUser.work_role || '',
      soul_id: selectedUser.soul_id ? String(selectedUser.soul_id) : '',
      quality_rating: selectedUser.quality_rating || '',
    });
  }, [selectedEditUserId, users]);

  const handleUpdateUser = async () => {
    if (!selectedEditUserId) {
      toast.warning('⚠️ Select a user to update');
      return;
    }
    if (!editUserForm.email.trim() || !editUserForm.name.trim()) {
      toast.warning('⚠️ Email and Name are required');
      return;
    }
    try {
      const payload = {
        email: editUserForm.email.trim(),
        name: editUserForm.name.trim(),
        role: editUserForm.role,
        doj: editUserForm.doj,
        is_active: Boolean(editUserForm.is_active),
        weekoffs: editUserForm.weekoffs.length ? editUserForm.weekoffs : ['SUNDAY'],
        default_shift_id: editUserForm.default_shift_id || null,
        rpm_user_id: editUserForm.rpm_user_id || null,
        work_role: editUserForm.work_role.trim() || null,
        soul_id: editUserForm.soul_id.trim() || null,
        quality_rating: editUserForm.quality_rating.trim() || null,
      };
      if (editUserForm.dol) payload.dol = editUserForm.dol;
      await authenticatedRequest('PUT', `/admin/users/${selectedEditUserId}`, payload);
      toast.success('✅ User updated successfully');
      await fetchAllData();
    } catch (error) {
      toast.error('❌ Failed to update user', {
        description: error?.message || 'Please try again.',
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

  if (initialLoading) {
    return <LoaderThreeDemo />;
  }

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Manage Projects
          </TabsTrigger>
          <TabsTrigger value="allocations" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Team Allocations
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Quality Assessment
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
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
          <HoverEffect items={projectKpiItems} className="grid-cols-1 md:grid-cols-4 lg:grid-cols-4" />

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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Assign PM / APM to Projects
              </CardTitle>
              <CardDescription>
                Select project owners from manager list and save assignment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Project</Label>
                  <Combobox
                    items={filteredProjects.map((project) => `${project.name} (${project.code})`)}
                    value={
                      ownerAssignProjectId
                        ? (() => {
                            const p = filteredProjects.find((x) => x.id === ownerAssignProjectId) || projects.find((x) => x.id === ownerAssignProjectId);
                            return p ? `${p.name} (${p.code})` : '';
                          })()
                        : ''
                    }
                    onValueChange={(label) => {
                      const matched = filteredProjects.find((project) => `${project.name} (${project.code})` === label)
                        || projects.find((project) => `${project.name} (${project.code})` === label);
                      setOwnerAssignProjectId(matched?.id || '');
                    }}
                  >
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
                  <Label>Select PM / APM</Label>
                  <Select
                    value="__multi__"
                    onValueChange={(value) => {
                      if (value === '__multi__') return;
                      setOwnerAssignManagerIds((prev) =>
                        prev.includes(value)
                          ? prev.filter((id) => id !== value)
                          : [...prev, value]
                      );
                    }}
                    disabled={!ownerAssignProjectId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          ownerAssignManagerIds.length > 0
                            ? `${ownerAssignManagerIds.length} manager(s) selected`
                            : 'Choose manager(s)'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {managerOptions.map((manager) => (
                        <SelectItem key={manager.id} value={String(manager.id)}>
                          {ownerAssignManagerIds.includes(String(manager.id)) ? '✓ ' : ''}{manager.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {ownerAssignProjectId && (
                <div className="text-sm text-muted-foreground">
                  {selectedOwnerProject ? `Project: ${selectedOwnerProject.name}` : ''} | Selected owners:{' '}
                  {ownerAssignManagerIds.length
                    ? ownerAssignManagerIds
                        .map((id) => managerOptions.find((manager) => String(manager.id) === String(id))?.name || id)
                        .join(', ')
                    : 'None'}
                </div>
              )}
              <Button onClick={handleSaveProjectOwners} disabled={!ownerAssignProjectId}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save PM/APM Assignment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Team Allocations */}
        <TabsContent value="allocations" className="space-y-6">
          {/* Project Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Project</CardTitle>
            </CardHeader>
            <CardContent>
              <Combobox
                items={projects.map((project) => `${project.name} (${project.code})`)}
                value={
                  selectedProjectId
                    ? (() => {
                        const p = projects.find((x) => x.id === selectedProjectId);
                        return p ? `${p.name} (${p.code})` : '';
                      })()
                    : ''
                }
                onValueChange={(label) => {
                  const project = projects.find((p) => `${p.name} (${p.code})` === label);
                  setSelectedProjectId(project?.id || '');
                  setSelectedProjectName(project?.name || '');
                }}
              >
                <ComboboxInput placeholder="Select a project" className="w-full" />
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
                      <Combobox
                        items={availableUsers.map((u) => (u.email ? `${u.name} (${u.email})` : u.name))}
                        value={
                          addMemberUserId
                            ? (() => {
                                const u = availableUsers.find((x) => x.id === addMemberUserId) || users.find((x) => x.id === addMemberUserId);
                                return u ? (u.email ? `${u.name} (${u.email})` : u.name) : '';
                              })()
                            : ''
                        }
                        onValueChange={(label) => {
                          const matched = availableUsers.find((u) => (u.email ? `${u.name} (${u.email})` : u.name) === label)
                            || users.find((u) => (u.email ? `${u.name} (${u.email})` : u.name) === label);
                          setAddMemberUserId(matched?.id || '');
                        }}
                      >
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
                            <Combobox
                              items={projectMembers.map((m) => `${m.name} (${m.email || 'No email'})`)}
                              value={
                                editMemberUserId
                                  ? (() => {
                                      const m = projectMembers.find((x) => String(x.user_id) === String(editMemberUserId));
                                      return m ? `${m.name} (${m.email || 'No email'})` : '';
                                    })()
                                  : ''
                              }
                              onValueChange={(label) => {
                                const matched = projectMembers.find((m) => `${m.name} (${m.email || 'No email'})` === label);
                                setEditMemberUserId(matched ? String(matched.user_id) : '');
                              }}
                            >
                              <ComboboxInput placeholder="Select member" className="w-full" />
                              <ComboboxContent>
                                <ComboboxEmpty>No member found.</ComboboxEmpty>
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
                            <Combobox
                              items={projectMembers.map((m) => `${m.name} (${m.email || 'No email'})`)}
                              value={
                                removeMemberUserId
                                  ? (() => {
                                      const m = projectMembers.find((x) => String(x.user_id) === String(removeMemberUserId));
                                      return m ? `${m.name} (${m.email || 'No email'})` : '';
                                    })()
                                  : ''
                              }
                              onValueChange={(label) => {
                                const matched = projectMembers.find((m) => `${m.name} (${m.email || 'No email'})` === label);
                                setRemoveMemberUserId(matched ? String(matched.user_id) : '');
                              }}
                            >
                              <ComboboxInput placeholder="Select member" className="w-full" />
                              <ComboboxContent>
                                <ComboboxEmpty>No member found.</ComboboxEmpty>
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
                          <div className="space-y-2 flex items-end">
                            <Button onClick={openRemoveMemberConfirm} variant="destructive" className="w-full" disabled={!removeMemberUserId}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                            <Drawer open={removeMemberConfirmDrawerOpen} onOpenChange={setRemoveMemberConfirmDrawerOpen}>
                              <DrawerContent>
                                <DrawerHeader>
                                  <DrawerTitle>Are you sure you want to remove this member?</DrawerTitle>
                                  <DrawerDescription>
                                    This will remove {removeMemberDisplayName || 'the selected member'} from project {selectedProjectName || selectedProjectId}.
                                  </DrawerDescription>
                                </DrawerHeader>
                                <DrawerFooter className="items-center">
                                  <Button variant="destructive" onClick={handleRemoveMember} className="w-[70vw] max-w-[720px]">
                                    Confirm Remove
                                  </Button>
                                  <DrawerClose asChild>
                                    <Button variant="outline" className="w-[70vw] max-w-[720px]">Cancel</Button>
                                  </DrawerClose>
                                </DrawerFooter>
                              </DrawerContent>
                            </Drawer>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Update Weekoff for Users
                  </CardTitle>
                  <CardDescription>
                    Select a user and update weekoff days.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Select User</Label>
                      <Combobox
                        items={userOptions.map((u) => u.displayName)}
                        value={
                          weekoffUpdateUserId
                            ? (userOptions.find((u) => String(u.id) === String(weekoffUpdateUserId))?.displayName || '')
                            : ''
                        }
                        onValueChange={(display) => {
                          const matched = userOptions.find((u) => u.displayName === display);
                          setWeekoffUpdateUserId(matched?.id || '');
                        }}
                      >
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
                      <Label>Weekoff Days</Label>
                      <Combobox
                        multiple
                        items={WEEKOFF_OPTIONS}
                        value={weekoffUpdateValues}
                        onValueChange={setWeekoffUpdateValues}
                      >
                        <ComboboxInput
                          placeholder="Select weekoff day(s)"
                          disabled={!weekoffUpdateUserId}
                          className="w-full"
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>No day found.</ComboboxEmpty>
                          <ComboboxList>
                            {(day) => (
                              <ComboboxItem key={day} value={day}>
                                {day}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      <p className="text-xs text-muted-foreground">
                        {weekoffUpdateValues.length > 0
                          ? `Selected: ${weekoffUpdateValues.join(', ')}`
                          : 'No weekoff selected'}
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleUpdateUserWeekoff} disabled={!weekoffUpdateUserId}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update Weekoff
                  </Button>
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
                      <Combobox
                        items={qaUserOptions.map((u) => u.displayName)}
                        value={
                          qaSelectedUserId
                            ? (qaUserOptions.find((u) => String(u.id) === String(qaSelectedUserId))?.displayName || '')
                            : ''
                        }
                        onValueChange={(display) => {
                          const matched = qaUserOptions.find((u) => u.displayName === display);
                          setQaSelectedUserId(matched?.id || '');
                        }}
                      >
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
                      <Label>Select Project</Label>
                      <Combobox
                        items={projects.map((p) => p.name)}
                        value={qaSelectedProjectId ? (projects.find((p) => String(p.id) === String(qaSelectedProjectId))?.name || '') : ''}
                        onValueChange={(name) => {
                          const matched = projects.find((p) => p.name === name);
                          setQaSelectedProjectId(matched?.id || '');
                        }}
                      >
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

        <TabsContent value="users" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Add users, upload in bulk, and manage existing profiles with a cleaner workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <Tabs value={userMgmtAction} onValueChange={setUserMgmtAction} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="add">Add Users</TabsTrigger>
                  <TabsTrigger value="search">Search & Edit</TabsTrigger>
                </TabsList>

                <TabsContent value="add" className="space-y-6">
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Create Users</CardTitle>
                      <CardDescription>Choose single entry or CSV-based onboarding.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={addUserMethod} onValueChange={setAddUserMethod} className="space-y-6">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="single">Single User</TabsTrigger>
                          <TabsTrigger value="bulk">Bulk CSV Upload</TabsTrigger>
                        </TabsList>

                        <TabsContent value="single" className="space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium">Core Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                              <div className="space-y-2">
                                <Label>Email *</Label>
                                <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@example.com" />
                              </div>
                              <div className="space-y-2">
                                <Label>Name *</Label>
                                <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-sm font-medium">Role & Assignment</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                              <div className="space-y-2">
                                <Label>Role</Label>
                                <Select value={newUserRole} onValueChange={setNewUserRole}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {USER_ROLE_OPTIONS.map((role) => (
                                      <SelectItem key={role} value={role}>{role}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Date of Joining</Label>
                                <Input type="date" value={newUserDoj} onChange={(e) => setNewUserDoj(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>Default Shift</Label>
                                <Select value={newUserShiftId || '__none__'} onValueChange={(value) => setNewUserShiftId(value === '__none__' ? '' : value)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Select Shift --</SelectItem>
                                    {shiftOptions.map((shift) => (
                                      <SelectItem key={shift.id} value={shift.id}>{shift.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                              <div className="space-y-2">
                                <Label>Reporting Manager (RPM)</Label>
                                <Combobox
                                  items={['-- Select Manager --', ...managerOptions.map((m) => m.label)]}
                                  value={
                                    newUserRpmId
                                      ? (managerOptions.find((m) => String(m.id) === String(newUserRpmId))?.label || '')
                                      : '-- Select Manager --'
                                  }
                                  onValueChange={(label) => {
                                    if (label === '-- Select Manager --') {
                                      setNewUserRpmId('');
                                      return;
                                    }
                                    const matched = managerOptions.find((m) => m.label === label);
                                    setNewUserRpmId(matched ? String(matched.id) : '');
                                  }}
                                >
                                  <ComboboxInput placeholder="Select manager" className="w-full" />
                                  <ComboboxContent>
                                    <ComboboxEmpty>No manager found.</ComboboxEmpty>
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
                              <div className="space-y-2 md:col-span-2">
                                <Label>Weekoffs</Label>
                                <Combobox
                                  multiple
                                  items={WEEKOFF_OPTIONS}
                                  value={newUserWeekoffs}
                                  onValueChange={setNewUserWeekoffs}
                                >
                                  <ComboboxInput placeholder="Select weekoff day(s)" className="w-full" />
                                  <ComboboxContent>
                                    <ComboboxEmpty>No day found.</ComboboxEmpty>
                                    <ComboboxList>
                                      {(day) => (
                                        <ComboboxItem key={day} value={day}>
                                          {day}
                                        </ComboboxItem>
                                      )}
                                    </ComboboxList>
                                  </ComboboxContent>
                                </Combobox>
                                <p className="text-xs text-muted-foreground">
                                  {newUserWeekoffs.length > 0
                                    ? `Selected: ${newUserWeekoffs.join(', ')}`
                                    : 'No weekoff selected'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-sm font-medium">Optional Metadata</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                              <div className="space-y-2">
                                <Label>Work Role</Label>
                                <Input value={newUserWorkRole} onChange={(e) => setNewUserWorkRole(e.target.value)} placeholder="Optional" />
                              </div>
                              <div className="space-y-2">
                                <Label>Soul ID</Label>
                                <Input value={newUserSoulId} onChange={(e) => setNewUserSoulId(e.target.value)} placeholder="Optional UUID" />
                              </div>
                              <div className="space-y-2">
                                <Label>Quality Rating</Label>
                                <Input value={newUserQualityRating} onChange={(e) => setNewUserQualityRating(e.target.value)} placeholder="Optional" />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button onClick={handleAddSingleUser}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add User
                            </Button>
                          </div>
                        </TabsContent>

                        <TabsContent value="bulk" className="space-y-6">
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                              <div className="space-y-2">
                                <div className="text-sm">Required fields:</div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline">email</Badge>
                                  <Badge variant="outline">name</Badge>
                                  <Badge variant="outline">role</Badge>
                                </div>
                                <div className="text-sm">
                                  Optional: doj, work_role, weekoffs, shift_name, rpm_email, soul_id, quality_rating
                                </div>
                              </div>
                            </AlertDescription>
                          </Alert>
                          <input
                            ref={usersFileInputRef}
                            id="users-csv-upload"
                            type="file"
                            accept=".csv"
                            onChange={handleUsersFileUpload}
                            className="hidden"
                          />
                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => usersFileInputRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Select CSV File
                            </Button>
                            <span className="text-sm text-muted-foreground truncate">
                              {usersUploadFile ? usersUploadFile.name : 'No file selected'}
                            </span>
                          </div>
                          {usersCsvPreview && usersCsvPreview.length > 0 && (
                            <div className="rounded-md border overflow-auto max-h-[320px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    {Object.keys(usersCsvPreview[0]).map((key) => (
                                      <TableHead key={key}>{key}</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {usersCsvPreview.map((row, idx) => (
                                    <TableRow key={idx}>
                                      {Object.values(row).map((value, valueIdx) => (
                                        <TableCell key={valueIdx}>{String(value)}</TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                          {usersUploadErrors.length > 0 && (
                            <Card className="border-destructive/30">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-destructive">Upload Errors</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 max-h-[220px] overflow-auto">
                                {usersUploadErrors.map((error, idx) => (
                                  <p key={idx} className="text-sm text-destructive">{error}</p>
                                ))}
                              </CardContent>
                            </Card>
                          )}
                          <div className="flex justify-end">
                            <Button onClick={handleBulkUploadUsers} disabled={!usersUploadFile || uploading}>
                              {uploading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                              Upload Users
                            </Button>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="search" className="space-y-6">
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Find Users</CardTitle>
                      <CardDescription>Filter users, select one profile, then update details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                        <div className="space-y-2">
                          <Label>Search by Name</Label>
                          <Input value={userSearchName} onChange={(e) => setUserSearchName(e.target.value)} placeholder="Enter name..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Search by Email</Label>
                          <Input value={userSearchEmail} onChange={(e) => setUserSearchEmail(e.target.value)} placeholder="Enter email..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Active Status</Label>
                          <Select value={userSearchActive} onValueChange={setUserSearchActive}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="All">All</SelectItem>
                              <SelectItem value="Active Only">Active Only</SelectItem>
                              <SelectItem value="Inactive Only">Inactive Only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Select User</Label>
                        <Combobox
                          items={searchedUsers.map((u) => `${u.name} (${u.email}) - ${u.is_active ? 'Active' : 'Inactive'}`)}
                          value={
                            selectedEditUserId
                              ? (() => {
                                  const u = searchedUsers.find((x) => String(x.id) === String(selectedEditUserId));
                                  return u ? `${u.name} (${u.email}) - ${u.is_active ? 'Active' : 'Inactive'}` : '';
                                })()
                              : ''
                          }
                          onValueChange={(label) => {
                            const matched = searchedUsers.find((u) => `${u.name} (${u.email}) - ${u.is_active ? 'Active' : 'Inactive'}` === label);
                            setSelectedEditUserId(matched ? String(matched.id) : '');
                          }}
                        >
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
                    </CardContent>
                  </Card>

                  {selectedEditUserId && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Edit User Profile</CardTitle>
                        <CardDescription>Update fields and save changes.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium">Core Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                            <div className="space-y-2">
                              <Label>Email *</Label>
                              <Input value={editUserForm.email} onChange={(e) => setEditUserForm((prev) => ({ ...prev, email: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Name *</Label>
                              <Input value={editUserForm.name} onChange={(e) => setEditUserForm((prev) => ({ ...prev, name: e.target.value }))} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-sm font-medium">Role & Assignment</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                            <div className="space-y-2">
                              <Label>Role</Label>
                              <Select value={String(editUserForm.role || 'USER')} onValueChange={(value) => setEditUserForm((prev) => ({ ...prev, role: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {USER_ROLE_OPTIONS.map((role) => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Date of Joining</Label>
                              <Input type="date" value={editUserForm.doj || ''} onChange={(e) => setEditUserForm((prev) => ({ ...prev, doj: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Date of Leaving (Optional)</Label>
                              <Input type="date" value={editUserForm.dol || ''} onChange={(e) => setEditUserForm((prev) => ({ ...prev, dol: e.target.value }))} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                            <div className="space-y-2">
                              <Label>Default Shift</Label>
                              <Select value={editUserForm.default_shift_id || '__none__'} onValueChange={(value) => setEditUserForm((prev) => ({ ...prev, default_shift_id: value === '__none__' ? '' : value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">-- Select Shift --</SelectItem>
                                  {shiftOptions.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id}>{shift.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Reporting Manager (RPM)</Label>
                              <Combobox
                                items={['-- Select Manager --', ...managerOptions.map((m) => m.label)]}
                                value={
                                  editUserForm.rpm_user_id
                                    ? (managerOptions.find((m) => String(m.id) === String(editUserForm.rpm_user_id))?.label || '')
                                    : '-- Select Manager --'
                                }
                                onValueChange={(label) => {
                                  if (label === '-- Select Manager --') {
                                    setEditUserForm((prev) => ({ ...prev, rpm_user_id: '' }));
                                    return;
                                  }
                                  const matched = managerOptions.find((m) => m.label === label);
                                  setEditUserForm((prev) => ({ ...prev, rpm_user_id: matched ? String(matched.id) : '' }));
                                }}
                              >
                                <ComboboxInput placeholder="Select manager" className="w-full" />
                                <ComboboxContent>
                                  <ComboboxEmpty>No manager found.</ComboboxEmpty>
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
                            <div className="space-y-2 flex items-end">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="edit-user-active"
                                  checked={editUserForm.is_active}
                                  onCheckedChange={(checked) => setEditUserForm((prev) => ({ ...prev, is_active: Boolean(checked) }))}
                                />
                                <Label htmlFor="edit-user-active">Is Active</Label>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Weekoffs</Label>
                            <Combobox
                              multiple
                              items={WEEKOFF_OPTIONS}
                              value={editUserForm.weekoffs}
                              onValueChange={(values) =>
                                setEditUserForm((prev) => ({ ...prev, weekoffs: values }))
                              }
                            >
                              <ComboboxInput placeholder="Select weekoff day(s)" className="w-full" />
                              <ComboboxContent>
                                <ComboboxEmpty>No day found.</ComboboxEmpty>
                                <ComboboxList>
                                  {(day) => (
                                    <ComboboxItem key={day} value={day}>
                                      {day}
                                    </ComboboxItem>
                                  )}
                                </ComboboxList>
                              </ComboboxContent>
                            </Combobox>
                            <p className="text-xs text-muted-foreground">
                              {editUserForm.weekoffs.length > 0
                                ? `Selected: ${editUserForm.weekoffs.join(', ')}`
                                : 'No weekoff selected'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-sm font-medium">Optional Metadata</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6">
                            <div className="space-y-2">
                              <Label>Work Role</Label>
                              <Input value={editUserForm.work_role} onChange={(e) => setEditUserForm((prev) => ({ ...prev, work_role: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Soul ID</Label>
                              <Input value={editUserForm.soul_id} onChange={(e) => setEditUserForm((prev) => ({ ...prev, soul_id: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Quality Rating</Label>
                              <Input value={editUserForm.quality_rating} onChange={(e) => setEditUserForm((prev) => ({ ...prev, quality_rating: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button onClick={handleUpdateUser}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectManagementCenter;
