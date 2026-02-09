# Quick Start Guide

## 1. Install k6

**Windows:**
```powershell
# Using Chocolatey
choco install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

**Mac:**
```bash
brew install k6
```

**Linux:**
```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## 2. Configure Your Backend URL

Edit `config.js` and set your deployed backend URL:

```javascript
baseUrl: __ENV.BASE_URL || 'https://your-actual-backend-url.com',
```

Or set it as an environment variable:

**Windows PowerShell:**
```powershell
$env:BASE_URL="https://your-backend-url.com"
```

**Linux/Mac:**
```bash
export BASE_URL="https://your-backend-url.com"
```

## 3. Get Authentication Token

You need a valid authentication token to run most tests. Here are options:

### Option A: Get Token from Your Frontend
1. Open your frontend application
2. Open browser DevTools (F12)
3. Go to Network tab
4. Make any API request
5. Check the `Authorization` header - copy the token value

### Option B: Use Supabase Auth (if applicable)
If your backend uses Supabase, you can get a token via Supabase client:

```javascript
// Example: Get token from Supabase
const supabaseUrl = 'your-supabase-url'
const supabaseKey = 'your-supabase-anon-key'
// Use Supabase client to authenticate and get token
```

### Option C: Create a Test Script
Create a simple script to authenticate and get a token (see `get-token.js` example below).

## 4. Set the Token

**Windows PowerShell:**
```powershell
$env:AUTH_TOKEN="your-token-here"
```

**Linux/Mac:**
```bash
export AUTH_TOKEN="your-token-here"
```

## 5. Run Your First Test

Start with a smoke test to verify everything works:

```bash
k6 run scenarios/smoke.js
```

## 6. Run All Tests

**Windows:**
```powershell
.\run-all.ps1
```

**Linux/Mac:**
```bash
chmod +x run-all.sh
./run-all.sh
```

## Example: Getting Token via API

If your backend has a login endpoint, you can create a simple script:

```javascript
// get-token.js
import http from 'k6/http';

const baseUrl = __ENV.BASE_URL || 'https://your-backend-url.com';
const email = __ENV.EMAIL || 'test@example.com';
const password = __ENV.PASSWORD || 'password';

const response = http.post(`${baseUrl}/auth/login`, JSON.stringify({
  email: email,
  password: password,
}), {
  headers: { 'Content-Type': 'application/json' },
});

if (response.status === 200) {
  const body = JSON.parse(response.body);
  console.log('Token:', body.token || body.access_token);
} else {
  console.error('Failed to get token:', response.status, response.body);
}
```

Run it:
```bash
k6 run get-token.js --env BASE_URL=https://your-backend-url.com --env EMAIL=test@example.com --env PASSWORD=password
```

## Troubleshooting

### "No auth token provided" warning
- Make sure you've set the `AUTH_TOKEN` environment variable
- Verify the token is valid and not expired

### 401 Unauthorized errors
- Check that your token is in the correct format
- Verify the token hasn't expired
- Ensure the token includes the "Bearer " prefix (handled automatically by `getAuthHeaders()`)

### Connection errors
- Verify your `BASE_URL` is correct
- Check that your backend is accessible
- Ensure there are no firewall issues

### Tests running but no data
- Check that your backend has test data
- Verify endpoints are returning data
- Check backend logs for errors

## Next Steps

1. Review the test results and adjust thresholds if needed
2. Customize test scenarios for your specific use cases
3. Set up continuous performance monitoring
4. Integrate tests into your CI/CD pipeline
