// k6-tests/scenarios/warmup.js
// Warm-up test - Wake up the service before running actual tests

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { getAuthHeaders, checkResponse } from '../utils/auth.js';

/**
 * Warm-up Test - Wake up the service to avoid cold starts
 * Run this before other tests: k6 run scenarios/warmup.js
 */
export const options = {
  stages: [
    { duration: '30s', target: 1 }, // Single user for 30 seconds
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Very lenient for warm-up
    http_req_failed: ['rate<0.5'], // Allow failures during warm-up
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

  // Simple warm-up requests
  const endpoints = [
    `${baseUrl}/me`,
    `${baseUrl}/admin/projects/`,
    `${baseUrl}/admin/dashboard/stats`,
  ];

  for (const endpoint of endpoints) {
    const response = http.get(endpoint, { headers });
    check(response, {
      'warm-up request sent': (r) => r.status >= 200,
    });
    sleep(2);
  }
}
