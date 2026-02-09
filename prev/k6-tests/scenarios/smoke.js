// k6-tests/scenarios/smoke.js
// Smoke tests - Basic functionality verification

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { getAuthHeaders, checkResponse } from '../utils/auth.js';

/**
 * Smoke Test - Verify basic endpoints are accessible
 * Run with: k6 run scenarios/smoke.js
 */
export const options = {
  stages: [
    { duration: '1m', target: 1 }, // 1 user for 1 minute
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Production expectation: 95% of requests < 1s
    http_req_failed: ['rate<0.05'], // Less than 5% failures
  },
};

export default function () {
  const baseUrl = config.baseUrl;
  
  // Test 1: Health check or root endpoint
  const healthCheck = http.get(`${baseUrl}/`);
  check(healthCheck, {
    'health check status': (r) => r.status === 200 || r.status === 404, // 404 is ok if no root endpoint
  });

  // Test 2: Get current user info (requires auth token)
  // Note: You'll need to set up authentication first
  // For now, this will fail but shows the structure
  const token = __ENV.AUTH_TOKEN || null;
  if (token) {
    const meResponse = http.get(`${baseUrl}/me`, {
      headers: getAuthHeaders(token),
    });
    checkResponse(meResponse, 200);
  }

  // Test 3: Get projects list (requires auth)
  if (token) {
    const projectsResponse = http.get(`${baseUrl}/admin/projects/`, {
      headers: getAuthHeaders(token),
    });
    checkResponse(projectsResponse, 200);
  }

  // Test 4: Get users list (requires auth)
  if (token) {
    const usersResponse = http.get(`${baseUrl}/admin/users/`, {
      headers: getAuthHeaders(token),
    });
    checkResponse(usersResponse, 200);
  }

  // Test 5: Get dashboard stats (requires auth)
  if (token) {
    const statsResponse = http.get(`${baseUrl}/admin/dashboard/stats`, {
      headers: getAuthHeaders(token),
    });
    checkResponse(statsResponse, 200);
  }

  sleep(1);
}
