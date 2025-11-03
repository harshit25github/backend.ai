/**
 * k6 Stress Test - Travel API
 * Purpose: Find the breaking point of the system
 * Run: k6 run load-tests/k6-stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Ramp up to 50
    { duration: '2m', target: 100 },   // Ramp to 100
    { duration: '2m', target: 150 },   // Ramp to 150
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 250 },   // Push to 250
    { duration: '5m', target: 250 },   // Stay at 250
    { duration: '3m', target: 0 },     // Ramp down
  ],

  thresholds: {
    'http_req_duration': ['p(95)<5000'],  // Acceptable under stress
    'http_req_failed': ['rate<0.1'],      // Allow up to 10% errors
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
  const chatId = `stress-test-${__VU}-${Date.now()}`;

  const payload = JSON.stringify({
    message: 'Find flights from Delhi to Mumbai on January 10, 2 passengers, economy',
    chatId: chatId,
    conversationHistory: [],
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/chat`, payload, params);

  check(res, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  }) || errorRate.add(1);

  if (res.status !== 200) {
    console.warn(`⚠️  Non-200 response: ${res.status}, VU: ${__VU}, Iter: ${__ITER}`);
  }

  sleep(1);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    'stdout': JSON.stringify(data, null, 2),
    [`load-tests/results/stress-test-${timestamp}.json`]: JSON.stringify(data, null, 2),
  };
}
