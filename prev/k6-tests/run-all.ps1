# k6-tests/run-all.ps1
# PowerShell script to run all k6 test scenarios

# Colors for output
$GREEN = "`e[0;32m"
$YELLOW = "`e[1;33m"
$RED = "`e[0;31m"
$NC = "`e[0m"

# Check if k6 is installed
try {
    $null = Get-Command k6 -ErrorAction Stop
} catch {
    Write-Host "${RED}k6 is not installed. Please install it first.${NC}" -ForegroundColor Red
    exit 1
}

# Check if BASE_URL is set
if (-not $env:BASE_URL) {
    Write-Host "${YELLOW}Warning: BASE_URL not set. Using default from config.js${NC}" -ForegroundColor Yellow
}

# Check if AUTH_TOKEN is set
if (-not $env:AUTH_TOKEN) {
    Write-Host "${YELLOW}Warning: AUTH_TOKEN not set. Some tests may fail.${NC}" -ForegroundColor Yellow
}

Write-Host "${GREEN}Starting k6 test suite...${NC}" -ForegroundColor Green
Write-Host ""

# Array of test scenarios
$tests = @(
    "scenarios/smoke.js",
    "scenarios/load.js",
    "scenarios/stress.js",
    "scenarios/spike.js",
    "scenarios/api-coverage.js"
)

# Run each test
foreach ($test in $tests) {
    Write-Host "${GREEN}Running: $test${NC}" -ForegroundColor Green
    try {
        k6 run $test
    } catch {
        Write-Host "${RED}Test $test failed${NC}" -ForegroundColor Red
    }
    Write-Host ""
    Start-Sleep -Seconds 2  # Brief pause between tests
}

Write-Host "${GREEN}All tests completed!${NC}" -ForegroundColor Green

# Note: Soak test is excluded from run-all as it runs for 2 hours
Write-Host "${YELLOW}Note: Soak test (scenarios/soak.js) is excluded as it runs for 2 hours.${NC}" -ForegroundColor Yellow
Write-Host "${YELLOW}Run it separately: k6 run scenarios/soak.js${NC}" -ForegroundColor Yellow
