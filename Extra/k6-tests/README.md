# k6 Performance Testing Suite

This directory contains a comprehensive k6 test suite for benchmarking your Resource Management System backend API.

## Prerequisites

1. **Install k6**: 
   - Windows: `choco install k6` or download from [k6.io](https://k6.io/docs/getting-started/installation/)
   - Mac: `brew install k6`
   - Linux: Follow [official installation guide](https://k6.io/docs/getting-started/installation/)

2. **Get Authentication Token**:
   - You'll need a valid authentication token to run most tests
   - Obtain this from your authentication system (Supabase, JWT, etc.)
   - Set it as an environment variable: `AUTH_TOKEN=your-token-here`

## Configuration

1. **Set Base URL**: 
   - Edit `config.js` and update the `baseUrl` with your deployed backend URL
   - Or set it via environment variable: `BASE_URL=https://your-backend-url.com`

2. **Set Authentication**:
   - Set `AUTH_TOKEN` environment variable with a valid token
   - Optionally configure test user credentials in `config.js`

## Test Scenarios

### 1. Smoke Tests (`scenarios/smoke.js`)
Basic functionality verification with minimal load.
```bash
k6 run scenarios/smoke.js
```

### 2. Load Tests (`scenarios/load.js`)
Simulates normal expected traffic patterns.
```bash
k6 run scenarios/load.js
```

### 3. Stress Tests (`scenarios/stress.js`)
Pushes the system beyond normal capacity to find breaking points.
```bash
k6 run scenarios/stress.js
```

### 4. Spike Tests (`scenarios/spike.js`)
Tests system behavior under sudden traffic spikes.
```bash
k6 run scenarios/spike.js
```

### 5. Soak Tests (`scenarios/soak.js`)
Sustained load over extended period to detect memory leaks and degradation.
```bash
k6 run scenarios/soak.js
```

### 6. API Coverage Tests (`scenarios/api-coverage.js`)
Comprehensive test of all major API endpoints.
```bash
k6 run scenarios/api-coverage.js
```

## Running Tests

### Basic Usage
```bash
# Set environment variables
export BASE_URL=https://your-backend-url.com
export AUTH_TOKEN=your-token-here

# Run a specific test
k6 run scenarios/smoke.js
```

### With Custom Configuration
```bash
k6 run --env BASE_URL=https://api.example.com --env AUTH_TOKEN=token scenarios/load.js
```

### Windows PowerShell
```powershell
$env:BASE_URL="https://your-backend-url.com"
$env:AUTH_TOKEN="your-token-here"
k6 run scenarios/smoke.js
```

## Understanding Results

k6 provides detailed metrics:

- **http_req_duration**: Request duration (p95, p99 percentiles)
- **http_req_failed**: Failed request rate
- **http_reqs**: Requests per second
- **iterations**: Total test iterations
- **vus**: Virtual users

### Key Metrics to Monitor

1. **Response Time**: 
   - p95 < 500ms for normal load
   - p99 < 1000ms for normal load

2. **Error Rate**: 
   - Should be < 1% for normal operations
   - May be higher during stress tests

3. **Throughput**: 
   - Requests per second should meet your requirements

## Customization

### Adjusting Load Patterns

Edit the `stages` in each test file:
```javascript
stages: [
  { duration: '2m', target: 10 },  // Ramp up to 10 users over 2 minutes
  { duration: '5m', target: 10 },  // Stay at 10 users for 5 minutes
  { duration: '2m', target: 0 },    // Ramp down over 2 minutes
]
```

### Modifying Thresholds

Edit the `thresholds` in each test file:
```javascript
thresholds: {
  http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
  http_req_failed: ['rate<0.01'],     // < 1% failures
}
```

### Adding New Endpoints

1. Add endpoint test function in the appropriate scenario file
2. Call it from the main test function
3. Use `checkResponse()` helper for validation

## Authentication Setup

If your API uses Supabase or another auth system:

1. **Option 1**: Get token manually and set as environment variable
2. **Option 2**: Modify `utils/auth.js` to implement automatic token retrieval
3. **Option 3**: Use k6's `setup()` function to authenticate before tests run

Example with setup function:
```javascript
export function setup() {
  // Authenticate and return token
  const response = http.post(`${baseUrl}/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password'
  }));
  return { token: JSON.parse(response.body).token };
}

export default function (data) {
  // Use data.token in tests
}
```

## Continuous Integration

You can integrate k6 tests into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run k6 tests
  run: |
    k6 run scenarios/smoke.js
    k6 run scenarios/load.js
```

## Tips

1. **Start with smoke tests** to verify basic functionality
2. **Gradually increase load** to find your system's limits
3. **Monitor server resources** (CPU, memory, database) during tests
4. **Run tests during off-peak hours** to avoid affecting production
5. **Compare results** across different test runs to track performance trends

## Troubleshooting

### Tests failing with 401 Unauthorized
- Verify your `AUTH_TOKEN` is valid and not expired
- Check token format (should be Bearer token)

### Tests timing out
- Increase timeout values in k6 options
- Check if your backend is accessible
- Verify network connectivity

### High error rates
- Check backend logs for errors
- Verify database connectivity
- Check if rate limiting is enabled

## Next Steps

1. Customize test scenarios for your specific use cases
2. Add more endpoint coverage
3. Set up automated performance monitoring
4. Create custom metrics and dashboards
5. Integrate with monitoring tools (Grafana, Datadog, etc.)

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
- [k6 Examples](https://k6.io/docs/examples/)
