// k6-tests/scenarios/soak.js
// Soak tests - Sustained load over time

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { getAuthHeaders, checkResponse } from '../utils/auth.js';
import { randomItem } from '../utils/helpers.js';

/**
 * Soak Test - Sustained load to detect memory leaks and degradation
 * Run with: k6 run scenarios/soak.js
 * Note: This runs for 2 hours - adjust duration as needed
 */
export const options = {
  stages: [
    { duration: '5m', target: 10 },   // Ramp up
    { duration: '2h', target: 10 },    // Stay at 10 users for 2 hours
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Should remain stable over time
    http_req_failed: ['rate<0.01'],
    // Memory and CPU thresholds if using k6 cloud
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

  // Mix of operations
  const actions = [
    () => {
      const response = http.get(`${baseUrl}/me`, { headers });
      checkResponse(response, 200);
    },
    () => {
      const response = http.get(`${baseUrl}/admin/projects/`, { headers });
      checkResponse(response, 200);
    },
    () => {
      const response = http.get(`${baseUrl}/admin/users/`, {
        headers,
        params: { limit: 20 },
      });
      checkResponse(response, 200);
    },
    () => {
      const response = http.get(`${baseUrl}/admin/dashboard/stats`, { headers });
      checkResponse(response, 200);
    },
    () => {
      const response = http.get(`${baseUrl}/admin/dashboard/live`, { headers });
      checkResponse(response, 200);
    },
  ];

  const action = randomItem(actions);
  action();

  sleep(randomItem([2, 3, 4, 5, 6])); // Random sleep between 2-6 seconds
}
