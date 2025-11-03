# k6 Load Testing Setup Guide

## 📦 Installation (Windows)

### Option 1: Using Chocolatey (Recommended)
```bash
choco install k6
```

### Option 2: Using Winget
```bash
winget install k6 --source winget
```

### Option 3: Manual Installation
1. Go to: https://github.com/grafana/k6/releases
2. Download the Windows version (e.g., `k6-v0.48.0-windows-amd64.zip`)
3. Extract to `C:\k6\`
4. Add `C:\k6\` to your PATH environment variable
5. Restart terminal

### Verify Installation
```bash
k6 version
```

---

## 🎯 How k6 Works

### Core Concepts:

1. **Virtual Users (VUs)**: Simulated concurrent users
2. **Iterations**: Number of times each VU runs the test
3. **Duration**: How long the test runs
4. **Stages**: Ramp up/down pattern for realistic load

### Test Lifecycle:
```
Setup (once) → Init → VU Code (repeated) → Teardown (once)
```

---

## 🚀 Load Testing Stages

### Stage 1: Smoke Test
- **Purpose**: Verify system works with minimal load
- **VUs**: 1-2
- **Duration**: 1-2 minutes

### Stage 2: Load Test
- **Purpose**: Test normal expected load
- **VUs**: 10-100
- **Duration**: 5-10 minutes

### Stage 3: Stress Test
- **Purpose**: Find breaking point
- **VUs**: Increase until failure
- **Duration**: 10-15 minutes

### Stage 4: Spike Test
- **Purpose**: Test sudden traffic spikes
- **VUs**: 0 → 1000 → 0 (rapid changes)
- **Duration**: 5 minutes

### Stage 5: Soak Test (Endurance)
- **Purpose**: Test long-running stability
- **VUs**: Moderate (50-100)
- **Duration**: 1-4 hours

---

## 📊 Key Metrics k6 Reports

| Metric | Description |
|--------|-------------|
| `http_reqs` | Total HTTP requests |
| `http_req_duration` | Request response time (avg, min, max, p95, p99) |
| `http_req_failed` | Failed requests percentage |
| `vus` | Current virtual users |
| `vus_max` | Peak virtual users |
| `iterations` | Total test iterations |
| `data_received` | Total data downloaded |
| `data_sent` | Total data uploaded |

### Important Thresholds:
- **p95**: 95% of requests should be under X ms
- **p99**: 99% of requests should be under X ms
- **Error Rate**: Should be < 1%

---

## 📝 Basic Test Structure

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% of requests < 500ms
    'http_req_failed': ['rate<0.01'],    // < 1% failures
  },
};

// Test scenario
export default function () {
  const res = http.get('http://localhost:3000/api/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1); // Think time between requests
}
```

---

## 🎮 Running Tests

### Basic Run
```bash
k6 run test-script.js
```

### Run with Custom VUs
```bash
k6 run --vus 10 --duration 30s test-script.js
```

### Output Results to File
```bash
k6 run --out json=results.json test-script.js
```

### Generate HTML Report
```bash
k6 run --out json=results.json test-script.js
# Then use: https://github.com/benc-uk/k6-reporter
```

---

## 🔥 Real-World Testing Tips

### 1. **Start Small**
Always start with smoke tests (1-2 VUs) to verify your test works.

### 2. **Ramp Gradually**
Don't jump from 0 to 1000 VUs instantly. Ramp up gradually:
```javascript
stages: [
  { duration: '2m', target: 100 },   // Ramp up
  { duration: '5m', target: 100 },   // Stay
  { duration: '2m', target: 200 },   // Increase
  { duration: '5m', target: 200 },   // Stay
  { duration: '2m', target: 0 },     // Ramp down
]
```

### 3. **Use Think Time**
Add realistic delays between requests:
```javascript
sleep(randomIntBetween(1, 5)); // 1-5 seconds between requests
```

### 4. **Test Different Scenarios**
Create multiple scenarios for different user behaviors:
```javascript
export const options = {
  scenarios: {
    flight_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
      ],
      exec: 'testFlightSearch',
    },
    trip_planning: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
      ],
      exec: 'testTripPlanning',
    },
  },
};
```

### 5. **Monitor Your Server**
While k6 runs, monitor:
- CPU usage
- Memory usage
- Database connections
- API response times
- Error logs

---

## 📈 Interpreting Results

### Good Performance:
```
✓ http_req_duration..............: avg=245ms   p(95)=450ms
✓ http_req_failed................: 0.00%
  http_reqs......................: 5000
  vus............................: 100
```

### Poor Performance:
```
✗ http_req_duration..............: avg=2.5s    p(95)=5.2s
✗ http_req_failed................: 15.00%
  http_reqs......................: 1000
  vus............................: 100
```

---

## 🎯 Next Steps for Your Travel API

1. Install k6
2. Run the smoke test (1-2 VUs)
3. Run the load test (10-50 VUs)
4. Analyze bottlenecks
5. Optimize and re-test

---

## 📚 Resources

- Official Docs: https://k6.io/docs/
- Examples: https://k6.io/docs/examples/
- Cloud: https://app.k6.io/ (optional, for advanced features)
