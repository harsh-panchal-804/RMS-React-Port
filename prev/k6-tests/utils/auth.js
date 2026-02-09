// k6-tests/utils/auth.js
// Authentication helper functions

import http from 'k6/http';
import { check } from 'k6';
import { config } from '../config.js';

/**
 * Get authentication token
 * Note: Adjust this based on your actual auth endpoint
 * If using Supabase, you might need to call Supabase auth API directly
 */
export function getAuthToken(email, password) {
  // Option 1: If you have a login endpoint
  const loginUrl = `${config.baseUrl}/auth/login`;
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const response = http.post(loginUrl, payload, {
    headers: config.defaultHeaders,
  });

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    return body.token || body.access_token || body.accessToken;
  }

  // Option 2: If using Supabase, you might need to call Supabase directly
  // For now, return null and handle in test setup
  return null;
}

/**
 * Create authenticated headers with Bearer token
 */
export function getAuthHeaders(token) {
  const headers = {};
  // Copy default headers
  for (const key in config.defaultHeaders) {
    headers[key] = config.defaultHeaders[key];
  }
  // Add authorization header
  headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Check if response is successful
 */
export function checkResponse(response, expectedStatus = 200) {
  return check(response, {
    'status is correct': (r) => r.status === expectedStatus,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'has response body': (r) => r.body && r.body.length > 0,
  });
}

/**
 * Sleep for a random duration between min and max seconds
 * Note: Import sleep from 'k6' in files that use this
 */
export function randomSleep(min, max) {
  const duration = Math.random() * (max - min) + min;
  // This is a helper - actual sleep should be called in the test file
  return duration;
}
