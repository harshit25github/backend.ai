#!/bin/bash
# Run all k6 tests sequentially
# Usage: bash load-tests/run-all-tests.sh

echo "🚀 Starting k6 Load Testing Suite"
echo "=================================="
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null
then
    echo "❌ k6 is not installed!"
    echo "Install: choco install k6  OR  winget install k6"
    exit 1
fi

echo "✓ k6 is installed: $(k6 version | head -1)"
echo ""

# Check if server is running
API_URL="${API_URL:-http://localhost:3000}"
echo "🔍 Checking if API is running at $API_URL..."

if curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" | grep -q "200"; then
    echo "✓ API is running"
else
    echo "❌ API is not responding at $API_URL/health"
    echo "Please start your server first: npm start"
    exit 1
fi

echo ""
echo "=================================="
echo ""

# Test 1: Smoke Test
echo "📋 TEST 1/3: Smoke Test (2 VUs, 2 min)"
echo "Purpose: Verify basic functionality"
echo "-----------------------------------"
k6 run load-tests/k6-smoke-test.js

if [ $? -eq 0 ]; then
    echo "✅ Smoke test PASSED"
else
    echo "❌ Smoke test FAILED - stopping here"
    exit 1
fi

echo ""
echo "⏳ Waiting 10 seconds before next test..."
sleep 10
echo ""

# Test 2: Load Test
echo "📋 TEST 2/3: Load Test (10-50 VUs, 15 min)"
echo "Purpose: Test normal expected load"
echo "-----------------------------------"
k6 run load-tests/k6-load-test.js

if [ $? -eq 0 ]; then
    echo "✅ Load test PASSED"
else
    echo "⚠️  Load test had issues - check results"
fi

echo ""
echo "⏳ Waiting 10 seconds before stress test..."
sleep 10
echo ""

# Test 3: Stress Test
echo "📋 TEST 3/3: Stress Test (50-250 VUs, 25 min)"
echo "Purpose: Find system breaking point"
echo "-----------------------------------"
echo "⚠️  This test may cause high resource usage!"
read -p "Continue with stress test? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    k6 run load-tests/k6-stress-test.js

    if [ $? -eq 0 ]; then
        echo "✅ Stress test completed"
    else
        echo "⚠️  Stress test showed issues - this is expected"
    fi
else
    echo "⏭️  Skipped stress test"
fi

echo ""
echo "=================================="
echo "🎉 Testing Suite Complete!"
echo "=================================="
echo ""
echo "📊 Results saved in: load-tests/results/"
echo ""
