// k6-tests/scenarios/stress.js
// Stress tests - Beyond normal capacity

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { getAuthHeaders, checkResponse } from '../utils/auth.js';
import { randomItem } from '../utils/helpers.js';

/**
 * Stress Test - Push system beyond normal capacity
 * Run with: k6 run scenarios/stress.js
 */
export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 20 },   // Stay at 20
    { duration: '2m', target: 50 },    // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // More lenient for stress test
    http_req_failed: ['rate<0.05'], // Allow up to 5% failures under stress
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

  // Mix of read operations
  const actions = [
    () => http.get(`${baseUrl}/me`, { headers }),
    () => http.get(`${baseUrl}/admin/projects/`, { headers }),
    () => http.get(`${baseUrl}/admin/users/`, { headers }),
    () => http.get(`${baseUrl}/admin/dashboard/stats`, { headers }),
    () => http.get(`${baseUrl}/admin/dashboard/live`, { headers }),
    () => http.get(`${baseUrl}/admin/users/kpi_cards_info`, { headers }),
  ];

  const response = randomItem(actions)();
  check(response, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429, // 429 = rate limited
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(randomItem([0.5, 1, 1.5, 2]));
}
