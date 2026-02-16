// k6-tests/scenarios/load.js
// Load tests - Normal expected load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { getAuthHeaders, checkResponse } from '../utils/auth.js';
import { todayDate, daysAgo, randomItem } from '../utils/helpers.js';

/**
 * Load Test - Simulate normal expected traffic
 * Run with: k6 run scenarios/load.js
 */
export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp up to 20 users
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>10'],
  },
};

const token = __ENV.AUTH_TOKEN || null;

export default function () {
  const baseUrl = config.baseUrl;
  
  if (!token) {
    console.warn('No auth token provided. Some tests will fail.');
    return;
  }

  const headers = getAuthHeaders(token);

  // Simulate user workflow
  const userActions = [
    () => getUserInfo(baseUrl, headers),
    () => getProjects(baseUrl, headers),
    () => getUsers(baseUrl, headers),
    () => getDashboardStats(baseUrl, headers),
    () => getLiveWorkers(baseUrl, headers),
    () => getUserHistory(baseUrl, headers),
  ];

  // Execute random user actions
  const action = randomItem(userActions);
  action();

  sleep(randomItem([1, 2, 3, 4, 5])); // Random sleep between 1-5 seconds
}

function getUserInfo(baseUrl, headers) {
  const response = http.get(`${baseUrl}/me`, { headers });
  checkResponse(response, 200);
}

function getProjects(baseUrl, headers) {
  const response = http.get(`${baseUrl}/admin/projects/`, { headers });
  checkResponse(response, 200);
  
  // If projects exist, get details of a random project
  if (response.status === 200) {
    try {
      const projects = JSON.parse(response.body);
      if (projects && projects.length > 0) {
        const project = randomItem(projects);
        const projectResponse = http.get(`${baseUrl}/admin/projects/${project.id}`, { headers });
        checkResponse(projectResponse, 200);
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
}

function getUsers(baseUrl, headers) {
  const response = http.get(`${baseUrl}/admin/users/`, {
    headers,
    params: { limit: 20, offset: 0 },
  });
  checkResponse(response, 200);
}

function getDashboardStats(baseUrl, headers) {
  const response = http.get(`${baseUrl}/admin/dashboard/stats`, { headers });
  checkResponse(response, 200);
}

function getLiveWorkers(baseUrl, headers) {
  const response = http.get(`${baseUrl}/admin/dashboard/live`, { headers });
  checkResponse(response, 200);
}

function getUserHistory(baseUrl, headers) {
  const today = todayDate();
  const weekAgo = daysAgo(7);
  
  const response = http.get(`${baseUrl}/time/history`, {
    headers,
    params: {
      start_date: weekAgo,
      end_date: today,
    },
  });
  checkResponse(response, 200);
}
