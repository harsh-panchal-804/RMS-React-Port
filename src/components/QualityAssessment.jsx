import { useState, useEffect, useMemo } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import {
  getAllProjects,
  getAllUserMappings,
  getAllProjectMappings,
  submitQualityAssessment,
  getQualityRatings,
  bulkUploadQuality,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Star,
  Upload,
  FileText,
  Calendar as CalendarIcon,
  User,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Info,
  RefreshCw,
  Download,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const QualityAssessment = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Mode selection
  const [mode, setMode] = useState('Individual Assessment');
  
  // Data states
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [userNameMapping, setUserNameMapping] = useState({});
  const [userEmailMapping, setUserEmailMapping] = useState({});
  const [projectNameMapping, setProjectNameMapping] = useState({});
  const [qualityRatings, setQualityRatings] = useState([]);
  
  // Form states - Individual Assessment
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rating, setRating] = useState('GOOD');
  const [qualityScore, setQualityScore] = useState(7.0);
  const [accuracy, setAccuracy] = useState(null);
  const [criticalRate, setCriticalRate] = useState(null);
  const [notes, setNotes] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  // Bulk Upload states
  const [uploadedFile, setUploadedFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Check role access
  useEffect(() => {
    if (user && user.role && !['USER', 'ADMIN', 'MANAGER'].includes(user.role)) {
      toast.error('Access denied. Please log in.');
    }
  }, [user]);

  // Fetch all data
  const fetchAllData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const [projectsData, userMappings, projectMappings] = await Promise.all([
        getAllProjects(),
        getAllUserMappings(),
        getAllProjectMappings(),
      ]);
      
      const nameMap = userMappings.nameMap;
      const emailMap = userMappings.emailMap;
      const projectMap = projectMappings.nameMap;
      
      setProjects(projectsData);
      setUserNameMapping(nameMap);
      setUserEmailMapping(emailMap);
      setProjectNameMapping(projectMap);
      
      // Create users list with email
      const usersList = Object.entries(nameMap).map(([id, name]) => ({
        id,
        name,
        email: emailMap[id] || '',
      }));
      setUsers(usersList);
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

  // Fetch quality ratings when user/project/date changes
  useEffect(() => {
    if (mode === 'Individual Assessment' && selectedUserId && selectedProjectId) {
      fetchQualityRatings();
    }
  }, [selectedUserId, selectedProjectId, selectedDate, mode]);

  const fetchQualityRatings = async () => {
    if (!selectedUserId || !selectedProjectId) return;
    
    try {
      const startDate = format(subDays(selectedDate, 30), 'yyyy-MM-dd');
      const endDate = format(addDays(selectedDate, 1), 'yyyy-MM-dd');
      
      const ratings = await getQualityRatings({
        user_id: selectedUserId,
        project_id: selectedProjectId,
        start_date: startDate,
        end_date: endDate,
      });
      
      setQualityRatings(ratings);
    } catch (error) {
      console.error('Error fetching quality ratings:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAllData();
      if (selectedUserId && selectedProjectId) {
        await fetchQualityRatings();
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

  // Handle submit quality assessment
  const handleSubmitAssessment = async () => {
    if (!selectedUserId || !selectedProjectId) {
      toast.warning('⚠️ Missing required fields', {
        description: 'Please select both user and project.',
      });
      return;
    }

    try {
      const payload = {
        user_id: selectedUserId,
        project_id: selectedProjectId,
        metric_date: format(selectedDate, 'yyyy-MM-dd'),
        rating: rating,
        quality_score: qualityScore ? parseFloat(qualityScore) : null,
        accuracy: accuracy !== null ? parseFloat(accuracy) : null,
        critical_rate: criticalRate !== null ? parseFloat(criticalRate) : null,
        notes: notes.trim() || null,
      };

      await submitQualityAssessment(payload);
      toast.success('✅ Quality assessment saved successfully!', {
        description: 'The assessment has been recorded.',
      });
      
      // Reset form
      setQualityScore(7.0);
      setAccuracy(null);
      setCriticalRate(null);
      setNotes('');
      
      // Refresh data
      await fetchQualityRatings();
    } catch (error) {
      const errorMessage = error?.message || 'Failed to save quality assessment. Please try again.';
      toast.error('❌ Failed to save assessment', {
        description: errorMessage,
      });
    }
  };

  // Handle CSV file upload
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('❌ Invalid file type', {
        description: 'Please upload a CSV file.',
      });
      return;
    }

    setUploadedFile(file);
    
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
        setCsvPreview(preview);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('❌ Error reading CSV file', {
          description: 'Please check the file format.',
        });
      }
    };
    reader.readAsText(file);
  };

  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (!uploadedFile) {
      toast.warning('⚠️ No file selected', {
        description: 'Please select a CSV file to upload.',
      });
      return;
    }

    setUploading(true);
    try {
      const result = await bulkUploadQuality(uploadedFile);
      
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
      setUploadedFile(null);
      setCsvPreview(null);
      const fileInput = document.getElementById('csv-upload');
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

  // Format quality rating for display
  const formatRating = (rating) => {
    const ratingMap = {
      'GOOD': { label: 'Good', icon: '✅', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
      'AVERAGE': { label: 'Average', icon: '⚠️', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      'BAD': { label: 'Bad', icon: '❌', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
    };
    return ratingMap[rating] || { label: rating, icon: '', color: '' };
  };

  if (!user || !['USER', 'ADMIN', 'MANAGER'].includes(user.role)) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Please log in.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // User options with email display
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Star className="h-8 w-8" />
            Quality Assessment
          </h1>
          <p className="text-muted-foreground mt-1">
            Manually assess quality ratings for users on specific dates
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

      {/* Mode Selector */}
      <Card>
        <CardContent className="pt-6">
          <RadioGroup value={mode} onValueChange={setMode} className="flex flex-row gap-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Individual Assessment" id="individual" />
              <Label htmlFor="individual" className="cursor-pointer">Individual Assessment</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Bulk Upload" id="bulk" />
              <Label htmlFor="bulk" className="cursor-pointer">Bulk Upload</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {mode === 'Individual Assessment' ? (
        <div className="space-y-6">
          {/* Individual Assessment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Individual Quality Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {/* User, Project, Date Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Select User</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select User" />
                        </SelectTrigger>
                        <SelectContent>
                          {userOptions.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Select Project</Label>
                      <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
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
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, 'PPP') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              if (date) {
                                setSelectedDate(date);
                                setDatePickerOpen(false);
                              }
                            }}
                            initialFocus
                            defaultMonth={selectedDate}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Quality Rating and Score */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quality Rating</Label>
                      <Select value={rating} onValueChange={setRating}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GOOD">GOOD</SelectItem>
                          <SelectItem value="AVERAGE">AVERAGE</SelectItem>
                          <SelectItem value="BAD">BAD</SelectItem>
                        </SelectContent>
                      </Select>
                      <CardDescription>
                        GOOD: High quality work | AVERAGE: Acceptable quality | BAD: Poor quality requiring improvement
                      </CardDescription>
                    </div>

                    <div className="space-y-2">
                      <Label>Quality Score (0-10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={qualityScore}
                        onChange={(e) => setQualityScore(parseFloat(e.target.value) || 0)}
                        placeholder="7.0"
                      />
                      <CardDescription>
                        Numeric score from 0 (poor) to 10 (excellent). Optional but recommended.
                      </CardDescription>
                    </div>
                  </div>

                  {/* Accuracy and Critical Rate */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Accuracy (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={accuracy || ''}
                        onChange={(e) => setAccuracy(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Optional"
                      />
                      <CardDescription>
                        Percentage of work completed correctly (0-100%). Optional.
                      </CardDescription>
                    </div>

                    <div className="space-y-2">
                      <Label>Critical Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={criticalRate || ''}
                        onChange={(e) => setCriticalRate(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Optional"
                      />
                      <CardDescription>
                        Percentage of critical tasks handled successfully (0-100%). Optional.
                      </CardDescription>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Assessment Notes (Optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any additional comments about the quality assessment..."
                      rows={4}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmitAssessment}
                    className="w-full"
                    size="lg"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Quality Assessment
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Assessments */}
          {selectedUserId && selectedProjectId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Quality Assessments
                </CardTitle>
                <CardDescription>
                  Showing assessments for the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : qualityRatings.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No quality assessments found for this user/project combination in the last 30 days.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-md border overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 border-b">
                        <TableRow>
                          <TableHead className="min-w-[100px] whitespace-nowrap">Date</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap">Rating</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap">Score</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap">Accuracy</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap">Critical Rate</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap">Source</TableHead>
                          <TableHead className="min-w-[200px] whitespace-nowrap">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {qualityRatings.map((rating, idx) => {
                          const ratingInfo = formatRating(rating.quality_rating);
                          return (
                            <TableRow key={idx} className="hover:bg-muted/50">
                              <TableCell className="whitespace-nowrap">
                                {rating.metric_date ? format(parseISO(rating.metric_date), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Badge variant="outline" className={ratingInfo.color}>
                                  {ratingInfo.icon} {ratingInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {rating.quality_score !== null && rating.quality_score !== undefined
                                  ? `${rating.quality_score.toFixed(1)}`
                                  : 'N/A'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {rating.accuracy !== null && rating.accuracy !== undefined
                                  ? `${rating.accuracy.toFixed(1)}%`
                                  : 'N/A'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {rating.critical_rate !== null && rating.critical_rate !== undefined
                                  ? `${rating.critical_rate.toFixed(1)}%`
                                  : 'N/A'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {rating.source || 'N/A'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {rating.notes || '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Quality Assessment Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format Required:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li><code>user_email</code>: User's email address</li>
                  <li><code>project_code</code>: Project code</li>
                  <li><code>metric_date</code>: Date in YYYY-MM-DD format</li>
                  <li><code>rating</code>: Quality rating (GOOD, AVERAGE, or BAD)</li>
                  <li><code>quality_score</code> (optional): Numeric score 0-10</li>
                  <li><code>accuracy</code> (optional): Accuracy percentage 0-100</li>
                  <li><code>critical_rate</code> (optional): Critical rate percentage 0-100</li>
                  <li><code>work_role</code> (optional): Work role</li>
                  <li><code>notes</code> (optional): Assessment notes</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-upload">Upload CSV File</Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
                <CardDescription>
                  Upload a CSV file with quality assessments
                </CardDescription>
              </div>

              {csvPreview && csvPreview.length > 0 && (
                <div className="space-y-2">
                  <Label>CSV Preview (First 10 rows)</Label>
                  <div className="rounded-md border overflow-auto max-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(csvPreview[0]).map(key => (
                            <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.map((row, idx) => (
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
                onClick={handleBulkUpload}
                disabled={!uploadedFile || uploading}
                className="w-full"
                size="lg"
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
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        Quality Assessment | Quality ratings are manually assessed and separate from productivity
      </div>
    </div>
  );
};

export default QualityAssessment;
