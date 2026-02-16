// k6-tests/get-token-example.js
// Example script to get authentication token
// Adjust this based on your actual authentication endpoint

import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL || 'https://your-backend-url.com';
const email = __ENV.EMAIL || 'test@example.com';
const password = __ENV.PASSWORD || 'password';

// Option 1: If you have a direct login endpoint
export default function () {
  const loginUrl = `${baseUrl}/auth/login`;
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const response = http.post(loginUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'login successful': (r) => r.status === 200,
  });

  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      const token = body.token || body.access_token || body.accessToken || body.data?.token;
      
      if (token) {
        console.log('\n=== AUTHENTICATION TOKEN ===');
        console.log(token);
        console.log('\nSet it as environment variable:');
        console.log(`export AUTH_TOKEN="${token}"`);
        console.log('Or in PowerShell:');
        console.log(`$env:AUTH_TOKEN="${token}"`);
        console.log('============================\n');
      } else {
        console.error('Token not found in response:', response.body);
      }
    } catch (e) {
      console.error('Failed to parse response:', e);
    }
  } else {
    console.error('Login failed:', response.status, response.body);
  }
}

// Option 2: If using Supabase, you might need to call Supabase directly
// Uncomment and adjust if needed:
/*
import { check } from 'k6';
import http from 'k6/http';

const supabaseUrl = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';
const email = __ENV.EMAIL || 'test@example.com';
const password = __ENV.PASSWORD || 'password';

export default function () {
  const loginUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const response = http.post(loginUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
    },
  });

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    const token = body.access_token;
    console.log('\n=== SUPABASE TOKEN ===');
    console.log(token);
    console.log(`export AUTH_TOKEN="${token}"`);
    console.log('=====================\n');
  }
}
*/
