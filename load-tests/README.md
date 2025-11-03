# Load Testing with k6

## 🚀 Quick Start

### 1. Install k6

**Windows (Chocolatey):**
```bash
choco install k6
```

**Windows (Winget):**
```bash
winget install k6 --source winget
```

**Verify installation:**
```bash
k6 version
```

### 2. Start Your Backend

Make sure your travel API is running:
```bash
npm start
# or
node src/server.js
```

### 3. Run Tests

**Smoke Test (2 VUs, 2 minutes):**
```bash
k6 run load-tests/k6-smoke-test.js
```

**Load Test (10-50 VUs, 15 minutes):**
```bash
k6 run load-tests/k6-load-test.js
```

**Stress Test (50-250 VUs, 25 minutes):**
```bash
k6 run load-tests/k6-stress-test.js
```

---

## 📁 Test Files

| File | Purpose | VUs | Duration | When to Use |
|------|---------|-----|----------|-------------|
| `k6-smoke-test.js` | Verify basic functionality | 2 | 2 min | Before deployments |
| `k6-load-test.js` | Test normal load | 10-50 | 15 min | Regular testing |
| `k6-stress-test.js` | Find breaking point | 50-250 | 25 min | Capacity planning |

---

## 📊 Understanding Results

### Good Performance Example:
```
✓ http_req_duration..............: avg=450ms   min=120ms  max=2.1s   p(95)=890ms
✓ http_req_failed................: 0.50%
  http_reqs......................: 5000
  vus............................: 50
```

### Warning Signs:
```
✗ http_req_duration..............: avg=3.5s    p(95)=8.2s    ← Too slow!
✗ http_req_failed................: 15.00%       ← Too many errors!
```

---

## 🎯 What to Monitor

While tests run, check:

1. **Server CPU**: Should stay < 80%
2. **Memory**: Watch for memory leaks
3. **Database**: Connection pool usage
4. **Response Times**: Should stay consistent
5. **Error Logs**: Look for errors/crashes

---

## 🔧 Customizing Tests

### Change API URL:
```bash
k6 run -e API_URL=http://production-server.com load-tests/k6-load-test.js
```

### Increase VUs:
```bash
k6 run --vus 100 --duration 5m load-tests/k6-smoke-test.js
```

### Save Results:
```bash
k6 run --out json=results.json load-tests/k6-load-test.js
```

---

## 📈 Results Location

All test results are saved to:
```
load-tests/results/
├── smoke-test-results.json
├── load-test-{timestamp}.json
└── stress-test-{timestamp}.json
```

---

## 🎓 Next Steps

1. **Start with Smoke Test**: Verify everything works
2. **Run Load Test**: Find normal performance baseline
3. **Optimize**: Fix any bottlenecks
4. **Run Stress Test**: Find your limits
5. **Set Monitoring**: Add alerts based on results

---

## 📚 Resources

- k6 Docs: https://k6.io/docs/
- Example Tests: https://k6.io/docs/examples/
- Best Practices: https://k6.io/docs/misc/fine-tuning-os/
