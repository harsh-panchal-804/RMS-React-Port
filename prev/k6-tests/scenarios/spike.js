// k6-tests/scenarios/spike.js
// Spike tests - Sudden traffic spikes

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { getAuthHeaders } from '../utils/auth.js';
import { randomItem } from '../utils/helpers.js';

/**
 * Spike Test - Sudden traffic spikes
 * Run with: k6 run scenarios/spike.js
 */
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Normal load
    { duration: '30s', target: 100 }, // Sudden spike to 100 users
    { duration: '1m', target: 100 },   // Stay at spike
    { duration: '30s', target: 10 },  // Sudden drop
    { duration: '1m', target: 10 },   // Back to normal
    { duration: '30s', target: 150 }, // Another spike
    { duration: '1m', target: 150 },
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.1'], // Allow up to 10% failures during spikes
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

  // Quick read operations
  const endpoints = [
    `${baseUrl}/me`,
    `${baseUrl}/admin/projects/`,
    `${baseUrl}/admin/users/`,
    `${baseUrl}/admin/dashboard/stats`,
  ];

  const url = randomItem(endpoints);
  const response = http.get(url, { headers });

  check(response, {
    'status is ok': (r) => r.status === 200 || r.status === 429,
    'response received': (r) => r.body.length > 0,
  });

  sleep(0.5); // Short sleep for spike scenario
}
