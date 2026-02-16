// k6-tests/config.js
// Configuration file for k6 tests

export const config = {
  // Base URL - Update this with your deployed backend URL
  baseUrl: __ENV.BASE_URL || 'https://resource-management-api-g4tr.onrender.com',
  
  // Test thresholds - Production performance expectations
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Less than 1% of requests should fail
    http_reqs: ['rate>10'], // At least 10 requests per second
  },
  
  // Default headers
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Test user credentials (for authentication)
// Note: In production, use environment variables or a test user pool
export const testUsers = {
  admin: {
    email: __ENV.ADMIN_EMAIL || 'admin@test.com',
    password: __ENV.ADMIN_PASSWORD || 'test-password',
    token: null, // Will be set during test execution
  },
  user: {
    email: __ENV.USER_EMAIL || 'user@test.com',
    password: __ENV.USER_PASSWORD || 'test-password',
    token: null,
  },
};
