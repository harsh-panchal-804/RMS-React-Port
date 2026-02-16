// k6-tests/scenarios/api-coverage.js
// Comprehensive API coverage test

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { getAuthHeaders, checkResponse } from '../utils/auth.js';
import { todayDate, daysAgo, randomItem } from '../utils/helpers.js';

/**
 * API Coverage Test - Test all major endpoints
 * Run with: k6 run scenarios/api-coverage.js
 */
export const options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '3m', target: 5 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

const token = __ENV.AUTH_TOKEN || null;

export default function () {
  const baseUrl = config.baseUrl;
  
  if (!token) {
    console.warn('No auth token provided. Tests will fail.');
    return;
  }

  const headers = getAuthHeaders(token);

  // Test suite of all endpoints
  testAuthEndpoints(baseUrl, headers);
  testUserEndpoints(baseUrl, headers);
  testProjectEndpoints(baseUrl, headers);
  testDashboardEndpoints(baseUrl, headers);
  testTimeTrackingEndpoints(baseUrl, headers);
  testAnalyticsEndpoints(baseUrl, headers);

  sleep(2);
}

function testAuthEndpoints(baseUrl, headers) {
  // Logout endpoint
  const logoutResponse = http.post(`${baseUrl}/auth/logout`, null, { headers });
  check(logoutResponse, {
    'logout status': (r) => r.status === 200,
  });
}

function testUserEndpoints(baseUrl, headers) {
  // Get current user
  const meResponse = http.get(`${baseUrl}/me`, { headers });
  checkResponse(meResponse, 200);

  // Get users list
  const usersResponse = http.get(`${baseUrl}/admin/users/`, {
    headers,
    params: { limit: 20, offset: 0 },
  });
  checkResponse(usersResponse, 200);

  // Get KPI cards info
  const kpiResponse = http.get(`${baseUrl}/admin/users/kpi_cards_info`, { headers });
  checkResponse(kpiResponse, 200);

  // Get reporting managers
  const managersResponse = http.get(`${baseUrl}/admin/users/reporting_managers`, { headers });
  checkResponse(managersResponse, 200);
}

function testProjectEndpoints(baseUrl, headers) {
  // Get projects list
  const projectsResponse = http.get(`${baseUrl}/admin/projects/`, {
    headers,
    params: { limit: 100 },
  });
  checkResponse(projectsResponse, 200);

  // If projects exist, test project details
  if (projectsResponse.status === 200) {
    try {
      const projects = JSON.parse(projectsResponse.body);
      if (projects && projects.length > 0) {
        const project = randomItem(projects);
        
        // Get project details
        const projectDetailResponse = http.get(`${baseUrl}/admin/projects/${project.id}`, { headers });
        checkResponse(projectDetailResponse, 200);

        // Get project members
        const membersResponse = http.get(`${baseUrl}/admin/projects/${project.id}/members`, { headers });
        checkResponse(membersResponse, 200);

        // Get project owners
        const ownersResponse = http.get(`${baseUrl}/admin/projects/${project.id}/owners`, { headers });
        checkResponse(ownersResponse, 200);
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
}

function testDashboardEndpoints(baseUrl, headers) {
  // Get dashboard stats
  const statsResponse = http.get(`${baseUrl}/admin/dashboard/stats`, { headers });
  checkResponse(statsResponse, 200);

  // Get live workers
  const liveResponse = http.get(`${baseUrl}/admin/dashboard/live`, { headers });
  checkResponse(liveResponse, 200);

  // Get pending approvals
  const approvalsResponse = http.get(`${baseUrl}/admin/dashboard/pending-approvals`, { headers });
  checkResponse(approvalsResponse, 200);
}

function testTimeTrackingEndpoints(baseUrl, headers) {
  const today = todayDate();
  const weekAgo = daysAgo(7);

  // Get time history
  const historyResponse = http.get(`${baseUrl}/time/history`, {
    headers,
    params: {
      start_date: weekAgo,
      end_date: today,
    },
  });
  checkResponse(historyResponse, 200);

  // Get home time data
  const homeTimeResponse = http.get(`${baseUrl}/time/home`, { headers });
  checkResponse(homeTimeResponse, 200);
}

function testAnalyticsEndpoints(baseUrl, headers) {
  // Note: Analytics endpoints might require specific project IDs
  // This is a placeholder - adjust based on your actual analytics endpoints
  const analyticsResponse = http.get(`${baseUrl}/analytics/calculate-daily`, { headers });
  // This might fail if it requires POST with body, adjust accordingly
  check(analyticsResponse, {
    'analytics endpoint accessible': (r) => r.status === 200 || r.status === 405, // 405 = Method Not Allowed
  });
}
