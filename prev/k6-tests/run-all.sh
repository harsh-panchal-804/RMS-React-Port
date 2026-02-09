#!/bin/bash
# k6-tests/run-all.sh
# Script to run all k6 test scenarios

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}k6 is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if BASE_URL is set
if [ -z "$BASE_URL" ]; then
    echo -e "${YELLOW}Warning: BASE_URL not set. Using default from config.js${NC}"
fi

# Check if AUTH_TOKEN is set
if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}Warning: AUTH_TOKEN not set. Some tests may fail.${NC}"
fi

echo -e "${GREEN}Starting k6 test suite...${NC}\n"

# Array of test scenarios
tests=(
    "scenarios/smoke.js"
    "scenarios/load.js"
    "scenarios/stress.js"
    "scenarios/spike.js"
    "scenarios/api-coverage.js"
)

# Run each test
for test in "${tests[@]}"; do
    echo -e "${GREEN}Running: $test${NC}"
    k6 run "$test" || echo -e "${RED}Test $test failed${NC}"
    echo ""
    sleep 2  # Brief pause between tests
done

echo -e "${GREEN}All tests completed!${NC}"

# Note: Soak test is excluded from run-all as it runs for 2 hours
echo -e "${YELLOW}Note: Soak test (scenarios/soak.js) is excluded as it runs for 2 hours.${NC}"
echo -e "${YELLOW}Run it separately: k6 run scenarios/soak.js${NC}"
