/**
 * k6 Smoke Test - Travel API
 * Purpose: Verify the system works with minimal load (1-2 VUs)
 * Run: k6 run load-tests/k6-smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  vus: 2,           // 2 virtual users
  duration: '2m',   // Run for 2 minutes

  thresholds: {
    'http_req_duration': ['p(95)<1000'],  // 95% of requests should be < 1s
    'http_req_failed': ['rate<0.01'],     // Error rate should be < 1%
    'errors': ['rate<0.01'],              // Custom error rate < 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Health check
  let res = http.get(`${BASE_URL}/health`);

  check(res, {
    'health check status 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Simple trip planning request
  const payload = JSON.stringify({
    message: 'I want to plan a trip to Goa',
    chatId: `smoke-test-${__VU}-${Date.now()}`,
    conversationHistory: []
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  res = http.post(`${BASE_URL}/api/chat`, payload, params);

  check(res, {
    'chat API status 200': (r) => r.status === 200,
    'chat API has response': (r) => r.body.length > 0,
    'chat API response time < 5s': (r) => r.timings.duration < 5000,
  }) || errorRate.add(1);

  sleep(2); // Think time
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/smoke-test-results.json': JSON.stringify(data),
  };
}
