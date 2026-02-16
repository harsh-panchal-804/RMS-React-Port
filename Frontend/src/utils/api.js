import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const NGROK_BYPASS_HEADERS = {
  // Prevent ngrok free-tier browser interstitial (ERR_NGROK_6024) on XHR/fetch calls.
  'ngrok-skip-browser-warning': 'true',
};

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
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

  const fullUrl = `${API_BASE_URL}${endpoint}`;
  console.log(`🌐 API Call: ${method} ${fullUrl}`, params ? { params } : '');
  console.log(`🔑 Using token: ${token.substring(0, 20)}...`);

  try {
    // Supabase typically expects Bearer token in Authorization header
    // The backend's get_current_user dependency likely extracts the token from Authorization header
    const config = {
      method,
      url: fullUrl,
      headers: {
        ...NGROK_BYPASS_HEADERS,
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

// Simple in-memory cache for mappings with request deduplication
let userMappingsCache = null;
let projectMappingsCache = null;
let userCacheTimestamp = null;
let projectCacheTimestamp = null;
let userMappingsPromise = null; // Promise for in-flight request
let projectMappingsPromise = null; // Promise for in-flight request
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for user_daily data with request deduplication
const userDailyCache = new Map(); // key: cacheKey, value: { data, timestamp }
const userDailyPromises = new Map(); // key: cacheKey, value: Promise
const USER_DAILY_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for data cache

// Cache for getAllProjects and getAllUsers
let projectsCache = null;
let projectsCacheTimestamp = null;
let projectsPromise = null;
let usersCache = null;
let usersCacheTimestamp = null;
let usersPromise = null;
const GENERAL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for project-specific data
const projectMetricsCache = new Map(); // key: cacheKey, value: { data, timestamp }
const projectMetricsPromises = new Map(); // key: cacheKey, value: Promise
const projectAllocationCache = new Map(); // key: cacheKey, value: { data, timestamp }
const projectAllocationPromises = new Map(); // key: cacheKey, value: Promise
const PROJECT_DATA_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Generate cache keys
const getProjectMetricsCacheKey = (projectId, startDate, endDate) => {
  return `metrics_${projectId}_${startDate}_${endDate}`;
};

const getProjectAllocationCacheKey = (projectId, targetDate, onlyActive) => {
  return `allocation_${projectId}_${targetDate}_${onlyActive}`;
};

/**
 * Generate cache key for user_daily requests
 */
const getUserDailyCacheKey = (params) => {
  const { user_id, project_id, start_date, end_date } = params || {};
  return `user_daily_${user_id || 'all'}_${project_id || 'all'}_${start_date || 'all'}_${end_date || 'all'}`;
};

/**
 * Fetch all users once and return all mappings (name, email, soulId)
 * This consolidates getUserNameMapping, getUserEmailMapping, and getUserSoulIdMapping
 * Uses request deduplication to prevent concurrent duplicate requests
 */
export const getAllUserMappings = async (useCache = true) => {
  // Check cache
  if (useCache && userMappingsCache && userCacheTimestamp) {
    const now = Date.now();
    if (now - userCacheTimestamp < CACHE_DURATION) {
      console.log('📦 Using cached user mappings');
      return userMappingsCache;
    }
  }

  // If there's already an in-flight request, return that promise instead of making a new request
  if (userMappingsPromise) {
    console.log('⏳ Reusing in-flight user mappings request');
    return userMappingsPromise;
  }

  // Create the request promise
  userMappingsPromise = (async () => {
    try {
      console.log('🔄 Fetching user mappings from API...');
      const users = await authenticatedRequest('GET', '/admin/users/', { limit: 1000 });
      if (!users || !Array.isArray(users)) {
        return { nameMap: {}, emailMap: {}, soulIdMap: {} };
      }

      const nameMap = {};
      const emailMap = {};
      const soulIdMap = {};

      users.forEach((user) => {
        const userId = String(user.id);
        nameMap[userId] = user.name;
        emailMap[userId] = user.email || '';
        soulIdMap[userId] = user.soul_id ? String(user.soul_id) : '';
      });

      const mappings = { nameMap, emailMap, soulIdMap };
      
      // Update cache
      userMappingsCache = mappings;
      userCacheTimestamp = Date.now();
      
      console.log('✅ User mappings fetched and cached');
      return mappings;
    } catch (error) {
      console.error('Error fetching user mappings:', error);
      return { nameMap: {}, emailMap: {}, soulIdMap: {} };
    } finally {
      // Clear the promise so new requests can be made
      userMappingsPromise = null;
    }
  })();

  return userMappingsPromise;
};

/**
 * Fetch all projects once and return name mapping
 * Uses request deduplication to prevent concurrent duplicate requests
 */
export const getAllProjectMappings = async (useCache = true) => {
  // Check cache
  if (useCache && projectMappingsCache && projectCacheTimestamp) {
    const now = Date.now();
    if (now - projectCacheTimestamp < CACHE_DURATION) {
      console.log('📦 Using cached project mappings');
      return projectMappingsCache;
    }
  }

  // If there's already an in-flight request, return that promise instead of making a new request
  if (projectMappingsPromise) {
    console.log('⏳ Reusing in-flight project mappings request');
    return projectMappingsPromise;
  }

  // Create the request promise
  projectMappingsPromise = (async () => {
    try {
      console.log('🔄 Fetching project mappings from API...');
      let projects;
      try {
        projects = await authenticatedRequest('GET', '/admin/projects/', { limit: 1000 });
      } catch (adminError) {
        if (adminError.message && adminError.message.includes('401')) {
          console.warn('Admin endpoint returned 401, trying regular projects endpoint...');
          projects = await authenticatedRequest('GET', '/projects/', { limit: 1000 });
        } else {
          throw adminError;
        }
      }
      
      if (!projects || !Array.isArray(projects)) {
        console.warn('Projects response is not an array:', projects);
        return { nameMap: {} };
      }

      const nameMap = {};
      projects.forEach((project) => {
        nameMap[String(project.id)] = project.name;
      });

      const mappings = { nameMap };
      
      // Update cache
      projectMappingsCache = mappings;
      projectCacheTimestamp = Date.now();
      
      console.log('✅ Project mappings fetched and cached');
      return mappings;
    } catch (error) {
      console.error('Error fetching project mappings:', error);
      return { nameMap: {} };
    } finally {
      // Clear the promise so new requests can be made
      projectMappingsPromise = null;
    }
  })();

  return projectMappingsPromise;
};

/**
 * Fetch all users and create UUID -> name mapping
 * @deprecated Use getAllUserMappings() instead for better performance
 */
export const getUserNameMapping = async () => {
  const mappings = await getAllUserMappings();
  return mappings.nameMap;
};

/**
 * Fetch all users and create UUID -> email mapping
 * @deprecated Use getAllUserMappings() instead for better performance
 */
export const getUserEmailMapping = async () => {
  const mappings = await getAllUserMappings();
  return mappings.emailMap;
};

/**
 * Fetch all projects and create UUID -> name mapping
 * @deprecated Use getAllProjectMappings() instead for better performance
 */
export const getProjectNameMapping = async () => {
  const mappings = await getAllProjectMappings();
  return mappings.nameMap;
};

/**
 * Fetch project productivity data from API
 */
export const fetchProjectProductivityData = async (
  startDate = null,
  endDate = null,
  projectId = null,
  fetchAll = true,
  mappings = null // Accept mappings as parameter to avoid refetching
) => {
  try {
    // Get mappings if not provided
    let userMap, userEmailMap, projectMap;
    if (mappings) {
      userMap = mappings.userMap;
      userEmailMap = mappings.userEmailMap;
      projectMap = mappings.projectMap;
    } else {
      // Fetch all mappings in one go
      const [userMappings, projectMappings] = await Promise.all([
        getAllUserMappings(),
        getAllProjectMappings(),
      ]);
      userMap = userMappings.nameMap;
      userEmailMap = userMappings.emailMap;
      projectMap = projectMappings.nameMap;
    }

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
 * @deprecated Use getAllUserMappings() instead for better performance
 */
export const getUserSoulIdMapping = async () => {
  const mappings = await getAllUserMappings();
  return mappings.soulIdMap;
};

/**
 * Fetch user productivity data from API
 */
export const fetchUserProductivityData = async (
  startDate = null,
  endDate = null,
  userId = null,
  projectId = null,
  fetchAll = true,
  mappings = null // Accept mappings as parameter to avoid refetching
) => {
  try {
    // Get mappings if not provided
    let userMap, userEmailMap, projectMap, soulIdMap;
    if (mappings) {
      userMap = mappings.nameMap;
      userEmailMap = mappings.emailMap;
      soulIdMap = mappings.soulIdMap;
      projectMap = mappings.projectMap;
    } else {
      // Fetch all mappings in one go
      const [userMappings, projectMappings] = await Promise.all([
        getAllUserMappings(),
        getAllProjectMappings(),
      ]);
      userMap = userMappings.nameMap;
      userEmailMap = userMappings.emailMap;
      soulIdMap = userMappings.soulIdMap;
      projectMap = projectMappings.nameMap;
    }

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

    // Fetch user daily metrics with caching and request deduplication
    let userMetrics;
    const cacheKey = getUserDailyCacheKey(params);
    const now = Date.now();
    
    // Check cache
    const cached = userDailyCache.get(cacheKey);
    if (cached && (now - cached.timestamp < USER_DAILY_CACHE_DURATION)) {
      console.log('📦 Using cached user_daily data');
      userMetrics = cached.data;
    } else {
      // Check if there's an in-flight request
      if (userDailyPromises.has(cacheKey)) {
        console.log('⏳ Reusing in-flight user_daily request');
        userMetrics = await userDailyPromises.get(cacheKey);
      } else {
        // Create new request
        const requestPromise = authenticatedRequest('GET', '/admin/metrics/user_daily/', params);
        userDailyPromises.set(cacheKey, requestPromise);
        
        try {
          userMetrics = await requestPromise;
          // Cache the result
          userDailyCache.set(cacheKey, { data: userMetrics, timestamp: now });
          console.log('✅ User_daily data fetched and cached');
        } catch (error) {
          throw error;
        } finally {
          // Clear the promise
          userDailyPromises.delete(cacheKey);
        }
      }
    }
    
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

/**
 * Fetch all projects with caching
 */
export const getAllProjects = async (useCache = true) => {
  // Check cache
  if (useCache && projectsCache && projectsCacheTimestamp) {
    const now = Date.now();
    if (now - projectsCacheTimestamp < GENERAL_CACHE_DURATION) {
      console.log('📦 Using cached projects');
      return projectsCache;
    }
  }

  // If there's already an in-flight request, return that promise instead of making a new request
  if (projectsPromise) {
    console.log('⏳ Reusing in-flight projects request');
    return projectsPromise;
  }

  // Create the request promise
  projectsPromise = (async () => {
    try {
      console.log('🔄 Fetching projects from API...');
      // Try with trailing slash first (most common)
      let projects = await authenticatedRequest('GET', '/admin/projects/');
      if (!Array.isArray(projects)) {
        // Fallback: try without trailing slash
        projects = await authenticatedRequest('GET', '/admin/projects');
      }
      
      if (!Array.isArray(projects)) {
        return [];
      }

      // Update cache
      projectsCache = projects;
      projectsCacheTimestamp = Date.now();
      console.log('✅ Projects fetched and cached');
      return projects;
    } catch (error) {
      // If admin endpoint fails, try regular projects endpoint
      if (error.response?.status === 404 || error.message?.includes('404')) {
        try {
          console.warn('Admin projects endpoint returned 404, trying regular projects endpoint...');
          const projects = await authenticatedRequest('GET', '/projects/');
          if (Array.isArray(projects)) {
            projectsCache = projects;
            projectsCacheTimestamp = Date.now();
            return projects;
          }
        } catch (fallbackError) {
          console.error('Error fetching projects from fallback endpoint:', fallbackError);
        }
      }
      console.error('Error fetching projects:', error);
      return [];
    } finally {
      // Clear the promise so new requests can be made
      projectsPromise = null;
    }
  })();

  return projectsPromise;
};

/**
 * Fetch all users with caching
 */
export const getAllUsers = async (params = {}, useCache = true) => {
  // Generate cache key based on params
  const cacheKey = JSON.stringify(params);
  const cacheEntry = usersCache?.[cacheKey];
  
  // Check cache (only if no params or params match)
  if (useCache && cacheEntry && cacheEntry.timestamp) {
    const now = Date.now();
    if (now - cacheEntry.timestamp < GENERAL_CACHE_DURATION) {
      console.log('📦 Using cached users');
      return cacheEntry.data;
    }
  }

  // If there's already an in-flight request with same params, return that promise
  if (usersPromise && usersPromise.cacheKey === cacheKey) {
    console.log('⏳ Reusing in-flight users request');
    return usersPromise;
  }

  // Create the request promise
  const requestPromise = (async () => {
    try {
      console.log('🔄 Fetching users from API...', params);
      const users = await authenticatedRequest('GET', '/admin/users/', params);
      const usersArray = Array.isArray(users) ? users : [];
      
      // Update cache
      if (!usersCache) {
        usersCache = {};
      }
      usersCache[cacheKey] = {
        data: usersArray,
        timestamp: Date.now(),
      };
      console.log('✅ Users fetched and cached');
      return usersArray;
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    } finally {
      // Clear the promise if it matches this request
      if (usersPromise === requestPromise) {
        usersPromise = null;
      }
    }
  })();

  // Store cache key on promise for deduplication
  requestPromise.cacheKey = cacheKey;
  usersPromise = requestPromise;

  return requestPromise;
};

/**
 * Fetch users with filter (for specific date)
 */
export const getUsersWithFilter = async (date) => {
  try {
    const response = await authenticatedRequest('POST', '/admin/users/users_with_filter', { date });
    return response?.items || [];
  } catch (error) {
    console.error('Error fetching users with filter:', error);
    return [];
  }
};

/**
 * Fetch project metrics for a date range
 */
export const getProjectMetrics = async (projectId, startDate, endDate, useCache = true) => {
  const cacheKey = getProjectMetricsCacheKey(projectId, startDate, endDate);
  const now = Date.now();
  
  // Check cache
  if (useCache) {
    const cached = projectMetricsCache.get(cacheKey);
    if (cached && (now - cached.timestamp < PROJECT_DATA_CACHE_DURATION)) {
      console.log('📦 Using cached project metrics');
      return cached.data;
    }
  }

  // Check for in-flight request
  if (projectMetricsPromises.has(cacheKey)) {
    console.log('⏳ Reusing in-flight project metrics request');
    return projectMetricsPromises.get(cacheKey);
  }

  // Create request promise
  const requestPromise = (async () => {
    try {
      console.log('🔄 Fetching project metrics from API...');
      const metrics = await authenticatedRequest('GET', '/admin/metrics/user_daily/', {
        project_id: projectId,
        start_date: startDate,
        end_date: endDate,
      });
      const metricsArray = Array.isArray(metrics) ? metrics : [];
      
      // Cache the result
      projectMetricsCache.set(cacheKey, { data: metricsArray, timestamp: now });
      console.log('✅ Project metrics fetched and cached');
      return metricsArray;
    } catch (error) {
      console.error('Error fetching project metrics:', error);
      return [];
    } finally {
      projectMetricsPromises.delete(cacheKey);
    }
  })();

  projectMetricsPromises.set(cacheKey, requestPromise);
  return requestPromise;
};

/**
 * Fetch project role counts for a specific date
 */
export const getProjectRoleCounts = async (projectId, targetDate) => {
  try {
    const counts = await authenticatedRequest('GET', '/admin/project-resource-allocation/role-counts', {
      project_id: projectId,
      target_date: targetDate,
    });
    return counts;
  } catch (error) {
    console.error('Error fetching project role counts:', error);
    return null;
  }
};

/**
 * Fetch project allocation data for a specific date
 */
export const getProjectAllocation = async (projectId, targetDate, onlyActive = true, useCache = true) => {
  const cacheKey = getProjectAllocationCacheKey(projectId, targetDate, onlyActive);
  const now = Date.now();
  
  // Check cache
  if (useCache) {
    const cached = projectAllocationCache.get(cacheKey);
    if (cached && (now - cached.timestamp < PROJECT_DATA_CACHE_DURATION)) {
      console.log('📦 Using cached project allocation');
      return cached.data;
    }
  }

  // Check for in-flight request
  if (projectAllocationPromises.has(cacheKey)) {
    console.log('⏳ Reusing in-flight project allocation request');
    return projectAllocationPromises.get(cacheKey);
  }

  // Create request promise
  const requestPromise = (async () => {
    try {
      console.log('🔄 Fetching project allocation from API...');
      const allocation = await authenticatedRequest('GET', '/admin/project-resource-allocation/', {
        project_id: projectId,
        target_date: targetDate,
        only_active: onlyActive,
      });
      
      // Cache the result
      projectAllocationCache.set(cacheKey, { data: allocation, timestamp: now });
      console.log('✅ Project allocation fetched and cached');
      return allocation;
    } catch (error) {
      console.error('Error fetching project allocation:', error);
      return null;
    } finally {
      projectAllocationPromises.delete(cacheKey);
    }
  })();

  projectAllocationPromises.set(cacheKey, requestPromise);
  return requestPromise;
};

/**
 * Get pending attendance requests
 */
export const getPendingAttendanceRequests = async (params = {}) => {
  try {
    const queryParams = { status: 'PENDING', ...params };
    const requests = await authenticatedRequest('GET', '/admin/attendance-requests/', queryParams);
    return Array.isArray(requests) ? requests : [];
  } catch (error) {
    console.error('Error fetching pending attendance requests:', error);
    return [];
  }
};

/**
 * Get all attendance requests with optional filters
 */
export const getAllAttendanceRequests = async (params = {}) => {
  try {
    const requests = await authenticatedRequest('GET', '/admin/attendance-requests/', params);
    return Array.isArray(requests) ? requests : [];
  } catch (error) {
    console.error('Error fetching attendance requests:', error);
    return [];
  }
};

/**
 * Get approval history
 */
export const getApprovalHistory = async (params = {}) => {
  try {
    const approvals = await authenticatedRequest('GET', '/admin/attendance-request-approvals/', params);
    return Array.isArray(approvals) ? approvals : [];
  } catch (error) {
    console.error('Error fetching approval history:', error);
    return [];
  }
};

/**
 * Submit approval/rejection for a request
 */
export const submitApproval = async (requestId, decision, comment = '') => {
  try {
    // Get current user ID from /me/ endpoint
    const meData = await authenticatedRequest('GET', '/me/');
    const approverUserId = meData?.id;
    
    if (!approverUserId) {
      throw new Error('Could not get user ID');
    }
    
    const payload = {
      request_id: requestId,
      approver_user_id: approverUserId,
      decision: decision,
      comment: comment,
    };
    
    // For POST requests, authenticatedRequest expects params to be the data payload
    const result = await authenticatedRequest('POST', '/admin/attendance-request-approvals/', payload);
    return result;
  } catch (error) {
    console.error('Error submitting approval:', error);
    throw error;
  }
};

/**
 * Update an approval record
 */
export const updateApproval = async (approvalId, decision, comment) => {
  try {
    const payload = { decision, comment };
    const result = await authenticatedRequest('PUT', `/admin/attendance-request-approvals/${approvalId}`, payload);
    return result;
  } catch (error) {
    console.error('Error updating approval:', error);
    throw error;
  }
};

/**
 * Delete an approval record
 */
export const deleteApproval = async (approvalId) => {
  try {
    const result = await authenticatedRequest('DELETE', `/admin/attendance-request-approvals/${approvalId}`);
    return result;
  } catch (error) {
    console.error('Error deleting approval:', error);
    throw error;
  }
};

/**
 * Submit quality assessment
 */
export const submitQualityAssessment = async (payload) => {
  try {
    const result = await authenticatedRequest('POST', '/admin/metrics/user_daily/quality', payload);
    return result;
  } catch (error) {
    console.error('Error submitting quality assessment:', error);
    throw error;
  }
};

/**
 * Get quality ratings for a user/project/date range
 */
export const getQualityRatings = async (params) => {
  try {
    const ratings = await authenticatedRequest('GET', '/admin/metrics/user_daily/quality-ratings', params);
    return Array.isArray(ratings) ? ratings : [];
  } catch (error) {
    console.error('Error fetching quality ratings:', error);
    return [];
  }
};

/**
 * Bulk upload quality assessments via CSV
 */
export const bulkUploadQuality = async (file) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${API_BASE_URL}/admin/bulk_uploads/quality`,
      formData,
      {
        headers: {
          ...NGROK_BYPASS_HEADERS,
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error bulk uploading quality assessments:', error);
    throw error;
  }
};

/**
 * Create a new project
 */
export const createProject = async (payload) => {
  try {
    const result = await authenticatedRequest('POST', '/admin/projects/', payload);
    return result;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

/**
 * Update a project
 */
export const updateProject = async (projectId, payload) => {
  try {
    const result = await authenticatedRequest('PUT', `/admin/projects/${projectId}`, payload);
    return result;
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
};

/**
 * Bulk upload projects via CSV
 */
export const bulkUploadProjects = async (file) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${API_BASE_URL}/admin/bulk_uploads/projects`,
      formData,
      {
        headers: {
          ...NGROK_BYPASS_HEADERS,
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error bulk uploading projects:', error);
    throw error;
  }
};

/**
 * Get project members
 */
export const getProjectMembers = async (projectId) => {
  try {
    const members = await authenticatedRequest('GET', `/admin/projects/${projectId}/members`);
    return Array.isArray(members) ? members : [];
  } catch (error) {
    console.error('Error fetching project members:', error);
    return [];
  }
};

/**
 * Add member to project
 */
export const addProjectMember = async (projectId, payload) => {
  try {
    const result = await authenticatedRequest('POST', `/admin/projects/${projectId}/members`, payload);
    return result;
  } catch (error) {
    console.error('Error adding project member:', error);
    throw error;
  }
};

/**
 * Update project member role
 */
export const updateProjectMemberRole = async (projectId, userId, payload) => {
  try {
    const result = await authenticatedRequest('PUT', `/admin/projects/${projectId}/members/${userId}`, payload);
    return result;
  } catch (error) {
    console.error('Error updating project member role:', error);
    throw error;
  }
};

/**
 * Remove member from project
 */
export const removeProjectMember = async (projectId, userId) => {
  try {
    const result = await authenticatedRequest('DELETE', `/admin/projects/${projectId}/members/${userId}`);
    return result;
  } catch (error) {
    console.error('Error removing project member:', error);
    throw error;
  }
};

/**
 * Get daily roster report (role drilldown)
 */
export const getDailyRosterReport = async (params) => {
  const fetchRosterBlob = async (requestParams, cleanToken) => {
    const response = await axios.get(
      `${API_BASE_URL}/reports/role-drilldown`,
      {
        params: requestParams,
        headers: {
          ...NGROK_BYPASS_HEADERS,
          'Authorization': `Bearer ${cleanToken}`,
        },
        responseType: 'blob',
      }
    );
    return response.data;
  };

  const isMissingReportDateError = async (error) => {
    if (error?.response?.status !== 422) return false;
    const payload = error.response?.data;
    if (!payload) return false;

    if (typeof payload === 'object' && Array.isArray(payload.detail)) {
      return payload.detail.some((item) => {
        const loc = Array.isArray(item?.loc) ? item.loc : [];
        return loc.includes('report_date');
      });
    }

    if (payload instanceof Blob) {
      try {
        const text = await payload.text();
        return text.includes('report_date');
      } catch {
        return false;
      }
    }

    if (typeof payload === 'string') {
      return payload.includes('report_date');
    }

    return false;
  };

  try {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    return await fetchRosterBlob(params, cleanToken);
  } catch (error) {
    const canTryReportDateFallback =
      params &&
      typeof params.start_date === 'string' &&
      typeof params.end_date === 'string';
    const missingReportDate = canTryReportDateFallback
      ? await isMissingReportDateError(error)
      : false;

    if (canTryReportDateFallback && missingReportDate) {
      try {
        const token = getToken();
        const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
        const baseParams = params.project_id
          ? { project_id: params.project_id }
          : {};

        // Backward compatibility for APIs that only accept report_date.
        if (params.start_date === params.end_date) {
          return await fetchRosterBlob(
            { ...baseParams, report_date: params.start_date },
            cleanToken
          );
        }

        const start = new Date(`${params.start_date}T00:00:00`);
        const end = new Date(`${params.end_date}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
          throw new Error('Invalid roster date range.');
        }

        const csvRows = [];
        let headerLine = '';
        const cursor = new Date(start);
        while (cursor <= end) {
          const day = cursor.toISOString().slice(0, 10);
          const blob = await fetchRosterBlob(
            { ...baseParams, report_date: day },
            cleanToken
          );
          const csvText = await blob.text();
          const lines = csvText.split('\n').filter((line) => line.trim());
          if (lines.length === 0) {
            cursor.setDate(cursor.getDate() + 1);
            continue;
          }
          if (!headerLine) headerLine = lines[0];
          csvRows.push(...lines.slice(1));
          cursor.setDate(cursor.getDate() + 1);
        }

        const mergedCsv = headerLine
          ? [headerLine, ...csvRows].join('\n')
          : '';
        return new Blob([mergedCsv], { type: 'text/csv' });
      } catch (fallbackError) {
        console.error('Daily roster report fallback failed:', fallbackError);
      }
    }

    console.error('Error fetching daily roster report:', error);
    throw error;
  }
};

/**
 * Get project history report
 */
export const getProjectHistoryReport = async (projectId, params = {}) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const response = await axios.get(
      `${API_BASE_URL}/reports/project-history`,
      {
        params: { project_id: projectId, ...params },
        headers: {
          ...NGROK_BYPASS_HEADERS,
          'Authorization': `Bearer ${cleanToken}`,
        },
        responseType: 'blob', // Get CSV as blob
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching project history report:', error);
    throw error;
  }
};

/**
 * Get user performance report
 */
export const getUserPerformanceReport = async (params) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const response = await axios.get(
      `${API_BASE_URL}/reports/user-performance`,
      {
        params,
        headers: {
          ...NGROK_BYPASS_HEADERS,
          'Authorization': `Bearer ${cleanToken}`,
        },
        responseType: 'blob', // Get CSV as blob
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching user performance report:', error);
    throw error;
  }
};
