import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    'VITE_API_BASE_URL is not defined. Please set it in your .env file.\n' +
    'Create a .env file in the project root with: VITE_API_BASE_URL=your_api_url'
  );
}

/**
 * Get authentication token from localStorage
 */
export const getToken = () => {
  return localStorage.getItem('token');
};

/**
 * Make authenticated API request
 */
export const authenticatedRequest = async (method, endpoint, params = null) => {
  const token = getToken();
  if (!token) {
    throw new Error('No authentication token found. Please set your token first.');
  }

  const fullUrl = `${API_BASE_URL}${endpoint}`;
  console.log(`🌐 API Call: ${method} ${fullUrl}`, params ? { params } : '');
  console.log(`🔑 Using token: ${token.substring(0, 20)}...`);

  try {
    // Clean token - remove "Bearer " prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    
    // Supabase typically expects Bearer token in Authorization header
    // The backend's get_current_user dependency likely extracts the token from Authorization header
    const config = {
      method,
      url: fullUrl,
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (params) {
      if (method === 'GET') {
        config.params = params;
      } else {
        config.data = params;
      }
    }

    const response = await axios(config);
    
    console.log(`✅ API Response: ${method} ${endpoint}`, {
      status: response.status,
      dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
    });
    
    if (response.status >= 400) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ API Error: ${method} ${endpoint}`, {
      status: error.response?.status,
      message: error.message,
      response: error.response?.data,
      headers: error.config?.headers,
    });
    
    // Special handling for 401 errors with Supabase token message
    if (error.response?.status === 401) {
      const errorDetail = error.response?.data?.detail || error.response?.data?.message || 'Unauthorized';
      console.error('🔐 Authentication Error Details:', {
        status: 401,
        detail: errorDetail,
        tokenPresent: !!token,
        tokenLength: cleanToken?.length,
        tokenStartsWith: cleanToken?.substring(0, 10),
        endpoint: endpoint,
        suggestion: errorDetail.includes('Supabase') || errorDetail.includes('token')
          ? 'The backend expects a valid Supabase JWT access token. Make sure:\n' +
            '1. You\'re using the access_token from Supabase auth (starts with "eyJ...")\n' +
            '2. The token is not expired\n' +
            '3. The token has the correct permissions\n' +
            '4. You\'re logged in on the other page and copying the correct token'
          : 'Check if your token is valid and not expired.',
      });
    }
    
    if (error.response) {
      const errorMessage = error.response.data?.detail || error.response.data?.message || error.response.statusText;
      throw new Error(`API Error: ${error.response.status} - ${errorMessage}`);
    }
    throw error;
  }
};

/**
 * Fetch all users and create UUID -> name mapping
 */
export const getUserNameMapping = async () => {
  try {
    const users = await authenticatedRequest('GET', '/admin/users/', { limit: 1000 });
    if (!users || !Array.isArray(users)) {
      return {};
    }
    return users.reduce((acc, user) => {
      acc[String(user.id)] = user.name;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching user name mapping:', error);
    return {};
  }
};

/**
 * Fetch all users and create UUID -> email mapping
 */
export const getUserEmailMapping = async () => {
  try {
    const users = await authenticatedRequest('GET', '/admin/users/', { limit: 1000 });
    if (!users || !Array.isArray(users)) {
      return {};
    }
    return users.reduce((acc, user) => {
      acc[String(user.id)] = user.email || '';
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching user email mapping:', error);
    return {};
  }
};

/**
 * Fetch all projects and create UUID -> name mapping
 */
export const getProjectNameMapping = async () => {
  try {
    // Try /admin/projects/ first, fallback to /projects/ if 401
    let projects;
    try {
      projects = await authenticatedRequest('GET', '/admin/projects/', { limit: 1000 });
    } catch (adminError) {
      if (adminError.message && adminError.message.includes('401')) {
        console.warn('Admin endpoint returned 401, trying regular projects endpoint...');
        try {
          projects = await authenticatedRequest('GET', '/projects/', { limit: 1000 });
        } catch (regularError) {
          console.error('Both endpoints failed:', regularError);
          throw regularError;
        }
      } else {
        throw adminError;
      }
    }
    
    if (!projects || !Array.isArray(projects)) {
      console.warn('Projects response is not an array:', projects);
      return {};
    }
    return projects.reduce((acc, project) => {
      acc[String(project.id)] = project.name;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching project name mapping:', error);
    console.warn('Returning empty project mapping - charts may not display project names');
    return {};
  }
};

/**
 * Fetch project productivity data from API
 */
export const fetchProjectProductivityData = async (
  startDate = null,
  endDate = null,
  projectId = null,
  fetchAll = true
) => {
  try {
    // Get name mappings
    const [userMap, userEmailMap, projectMap] = await Promise.all([
      getUserNameMapping(),
      getUserEmailMapping(),
      getProjectNameMapping(),
    ]);

    // Prepare params
    const params = {};
    if (projectId) {
      params.project_id = projectId;
    }

    if (!fetchAll) {
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
    } else {
      // Fetch last 90 days by default
      const defaultStart = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const defaultEnd = endDate || new Date().toISOString().split('T')[0];
      params.start_date = defaultStart;
      params.end_date = defaultEnd;
    }

    // Fetch user daily metrics
    const userMetrics = await authenticatedRequest('GET', '/admin/metrics/user_daily/', params);
    if (!userMetrics || !Array.isArray(userMetrics)) {
      return [];
    }

    // Process user metrics
    let data = userMetrics.map((metric) => {
      const dateObj = new Date(metric.metric_date);
      return {
        date: metric.metric_date,
        date_obj: dateObj,
        user_id: String(metric.user_id),
        project_id: String(metric.project_id),
        user: userMap[String(metric.user_id)] || 'Unknown',
        email: userEmailMap[String(metric.user_id)] || '',
        project: projectMap[String(metric.project_id)] || 'Unknown',
        role: metric.work_role || 'Unknown',
        hours_worked: metric.hours_worked || 0,
        tasks_completed: metric.tasks_completed || 0,
        productivity_score: metric.productivity_score || 0,
      };
    });

    // Calculate active_users per project per date
    const activeUsersMap = {};
    data.forEach((row) => {
      const key = `${row.project_id}_${row.date}`;
      if (!activeUsersMap[key]) {
        activeUsersMap[key] = new Set();
      }
      activeUsersMap[key].add(row.user_id);
    });

    data = data.map((row) => {
      const key = `${row.project_id}_${row.date}`;
      return {
        ...row,
        active_users: activeUsersMap[key]?.size || 0,
      };
    });

    // Fetch quality ratings
    const qualityParams = {};
    if (projectId) qualityParams.project_id = projectId;
    if (startDate) qualityParams.start_date = startDate;
    if (endDate) qualityParams.end_date = endDate;

    let qualityData = [];
    try {
      qualityData = await authenticatedRequest('GET', '/admin/metrics/user_daily/quality-ratings', qualityParams);
      if (!Array.isArray(qualityData)) {
        qualityData = [];
      }
    } catch (error) {
      console.warn('Error fetching quality ratings:', error);
      qualityData = [];
    }

    // Create quality mapping
    const qualityMap = {};
    const qualityScoreMap = {};
    const qualitySourceMap = {};
    const accuracyMap = {};
    const criticalRateMap = {};

    qualityData.forEach((q) => {
      const qDate = new Date(q.metric_date).toISOString().split('T')[0];
      const key = `${String(q.user_id)}_${String(q.project_id)}_${qDate}`;
      
      // Normalize rating
      const rating = q.quality_rating;
      if (rating === 'GOOD') {
        qualityMap[key] = 'Good';
      } else if (rating === 'AVERAGE') {
        qualityMap[key] = 'Average';
      } else if (rating === 'BAD') {
        qualityMap[key] = 'Bad';
      } else {
        qualityMap[key] = 'Not Assessed';
      }

      qualityScoreMap[key] = q.quality_score;
      qualitySourceMap[key] = q.source || 'MANUAL';
      accuracyMap[key] = q.accuracy;
      criticalRateMap[key] = q.critical_rate;
    });

    // Map quality ratings to data
    data = data.map((row) => {
      const key = `${row.user_id}_${row.project_id}_${row.date}`;
      return {
        ...row,
        quality_rating: qualityMap[key] || 'Not Assessed',
        quality_score: qualityScoreMap[key] ?? null,
        quality_source: qualitySourceMap[key] || null,
        accuracy: accuracyMap[key] ?? null,
        critical_rate: criticalRateMap[key] ?? null,
      };
    });

    // Add quality assessments that don't have corresponding metrics
    qualityData.forEach((q) => {
      const qDate = new Date(q.metric_date).toISOString().split('T')[0];
      const qUserId = String(q.user_id);
      const qProjectId = String(q.project_id);

      const existing = data.find(
        (row) =>
          row.user_id === qUserId &&
          row.project_id === qProjectId &&
          row.date === qDate
      );

      if (!existing) {
        const rating = q.quality_rating;
        let normalizedRating = 'Not Assessed';
        if (rating === 'GOOD') normalizedRating = 'Good';
        else if (rating === 'AVERAGE') normalizedRating = 'Average';
        else if (rating === 'BAD') normalizedRating = 'Bad';

        data.push({
          date: q.metric_date,
          date_obj: new Date(q.metric_date),
          user_id: qUserId,
          project_id: qProjectId,
          user: userMap[qUserId] || 'Unknown',
          email: userEmailMap[qUserId] || '',
          project: projectMap[qProjectId] || 'Unknown',
          role: 'Unknown',
          hours_worked: 0,
          tasks_completed: 0,
          productivity_score: 0,
          quality_rating: normalizedRating,
          quality_score: q.quality_score ?? null,
          quality_source: q.source || 'MANUAL',
          accuracy: q.accuracy ?? null,
          critical_rate: q.critical_rate ?? null,
          active_users: 0,
        });
      }
    });

    return data;
  } catch (error) {
    console.error('Error fetching project productivity data:', error);
    throw error;
  }
};

/**
 * Get user soul ID mapping
 */
export const getUserSoulIdMapping = async () => {
  try {
    const users = await authenticatedRequest('GET', '/admin/users/', { limit: 1000 });
    if (!users || !Array.isArray(users)) {
      return {};
    }
    return users.reduce((acc, user) => {
      const soulId = user.soul_id;
      acc[String(user.id)] = soulId ? String(soulId) : '';
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching user soul ID mapping:', error);
    return {};
  }
};

/**
 * Fetch user productivity data from API
 */
export const fetchUserProductivityData = async (
  startDate = null,
  endDate = null,
  userId = null,
  projectId = null,
  fetchAll = true
) => {
  try {
    // Get name mappings
    const [userMap, userEmailMap, projectMap, soulIdMap] = await Promise.all([
      getUserNameMapping(),
      getUserEmailMapping(),
      getProjectNameMapping(),
      getUserSoulIdMapping(),
    ]);

    // Prepare params
    const params = {};
    if (userId) params.user_id = userId;
    if (projectId) params.project_id = projectId;

    if (!fetchAll) {
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
    } else {
      // Fetch last 90 days by default
      const defaultStart = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const defaultEnd = endDate || new Date().toISOString().split('T')[0];
      params.start_date = defaultStart;
      params.end_date = defaultEnd;
    }

    // Fetch user daily metrics
    const userMetrics = await authenticatedRequest('GET', '/admin/metrics/user_daily/', params);
    if (!userMetrics || !Array.isArray(userMetrics)) {
      return [];
    }

    // Process user metrics
    let data = userMetrics.map((metric) => {
      const dateObj = new Date(metric.metric_date);
      return {
        date: metric.metric_date,
        date_obj: dateObj,
        user_id: String(metric.user_id),
        project_id: String(metric.project_id),
        user: userMap[String(metric.user_id)] || 'Unknown',
        email: userEmailMap[String(metric.user_id)] || '',
        project: projectMap[String(metric.project_id)] || 'Unknown',
        role: metric.work_role || 'Unknown',
        hours_worked: metric.hours_worked || 0,
        tasks_completed: metric.tasks_completed || 0,
        productivity_score: metric.productivity_score || 0,
        soul_id: soulIdMap[String(metric.user_id)] || '',
      };
    });

    // Fetch attendance data
    const attendanceParams = {};
    if (userId) attendanceParams.user_id = userId;
    if (projectId) attendanceParams.project_id = projectId;

    let attendanceData = [];
    try {
      attendanceData = await authenticatedRequest('GET', '/attendance-daily/', attendanceParams);
      if (!Array.isArray(attendanceData)) {
        attendanceData = [];
      }
    } catch (error) {
      console.warn('Error fetching attendance data:', error);
      attendanceData = [];
    }

    // Create attendance mapping
    const attendanceMap = {};
    attendanceData.forEach((att) => {
      const attDate = new Date(att.attendance_date).toISOString().split('T')[0];
      const key = `${String(att.user_id)}_${String(att.project_id)}_${attDate}`;
      const status = att.status || 'UNKNOWN';
      attendanceMap[key] = status;
    });

    // Map attendance status
    data = data.map((row) => {
      const dateStr = row.date.split('T')[0];
      const key = `${row.user_id}_${row.project_id}_${dateStr}`;
      const status = attendanceMap[key] || 'UNKNOWN';
      
      // Normalize status
      let normalizedStatus = 'Absent';
      if (status === 'PRESENT') normalizedStatus = 'Present';
      else if (status === 'WFH') normalizedStatus = 'WFH';
      else if (status === 'LEAVE') normalizedStatus = 'Leave';
      else if (status === 'ABSENT') normalizedStatus = 'Absent';
      
      return {
        ...row,
        attendance_status: normalizedStatus,
      };
    });

    // Fetch quality ratings
    const qualityParams = {};
    if (userId) qualityParams.user_id = userId;
    if (projectId) qualityParams.project_id = projectId;
    if (startDate) qualityParams.start_date = startDate;
    if (endDate) qualityParams.end_date = endDate;

    let qualityData = [];
    try {
      qualityData = await authenticatedRequest('GET', '/admin/metrics/user_daily/quality-ratings', qualityParams);
      if (!Array.isArray(qualityData)) {
        qualityData = [];
      }
    } catch (error) {
      console.warn('Error fetching quality ratings:', error);
      qualityData = [];
    }

    // Create quality mapping
    const qualityMap = {};
    const qualityScoreMap = {};
    const qualitySourceMap = {};
    const accuracyMap = {};
    const criticalRateMap = {};

    qualityData.forEach((q) => {
      const qDate = new Date(q.metric_date).toISOString().split('T')[0];
      const key = `${String(q.user_id)}_${String(q.project_id)}_${qDate}`;
      
      // Normalize rating
      const rating = q.quality_rating;
      if (rating === 'GOOD') {
        qualityMap[key] = 'Good';
      } else if (rating === 'AVERAGE') {
        qualityMap[key] = 'Average';
      } else if (rating === 'BAD') {
        qualityMap[key] = 'Bad';
      } else {
        qualityMap[key] = 'Not Assessed';
      }

      qualityScoreMap[key] = q.quality_score;
      qualitySourceMap[key] = q.source || 'MANUAL';
      accuracyMap[key] = q.accuracy;
      criticalRateMap[key] = q.critical_rate;
    });

    // Map quality ratings to data
    data = data.map((row) => {
      const dateStr = row.date.split('T')[0];
      const key = `${row.user_id}_${row.project_id}_${dateStr}`;
      return {
        ...row,
        quality_rating: qualityMap[key] || 'Not Assessed',
        quality_score: qualityScoreMap[key] || null,
        quality_source: qualitySourceMap[key] || null,
        accuracy: accuracyMap[key] || null,
        critical_rate: criticalRateMap[key] || null,
      };
    });

    // Add quality assessments that don't have corresponding metrics
    qualityData.forEach((q) => {
      const qDate = new Date(q.metric_date).toISOString().split('T')[0];
      const qUserId = String(q.user_id);
      const qProjectId = String(q.project_id);
      
      // Check if this quality assessment already has a corresponding metric row
      const existing = data.find(
        (row) =>
          row.user_id === qUserId &&
          row.project_id === qProjectId &&
          row.date.split('T')[0] === qDate
      );
      
      // If no metric exists for this quality assessment, create a row for it
      if (!existing) {
        const rating = q.quality_rating;
        let normalizedRating = 'Not Assessed';
        if (rating === 'GOOD') normalizedRating = 'Good';
        else if (rating === 'AVERAGE') normalizedRating = 'Average';
        else if (rating === 'BAD') normalizedRating = 'Bad';
        
        data.push({
          date: q.metric_date,
          date_obj: new Date(q.metric_date),
          user_id: qUserId,
          project_id: qProjectId,
          user: userMap[qUserId] || 'Unknown',
          email: userEmailMap[qUserId] || '',
          project: projectMap[qProjectId] || 'Unknown',
          role: 'Unknown',
          hours_worked: 0,
          tasks_completed: 0,
          productivity_score: 0,
          quality_rating: normalizedRating,
          quality_score: q.quality_score || null,
          quality_source: q.source || 'MANUAL',
          accuracy: q.accuracy || null,
          critical_rate: q.critical_rate || null,
          attendance_status: 'Absent',
          soul_id: soulIdMap[qUserId] || '',
        });
      }
    });

    return data;
  } catch (error) {
    console.error('Error fetching user productivity data:', error);
    throw error;
  }
};

/**
 * Get user role (placeholder - implement based on your auth system)
 */
export const getUserRole = () => {
  // This should be implemented based on your authentication system
  // For now, returning from localStorage or sessionStorage
  return localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
};
