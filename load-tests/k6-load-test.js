/**
 * k6 Load Test - Travel API
 * Purpose: Test with normal expected load (10-50 VUs)
 * Run: k6 run load-tests/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const chatResponseTime = new Trend('chat_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 VUs
    { duration: '3m', target: 10 },   // Stay at 10 VUs
    { duration: '1m', target: 30 },   // Ramp up to 30 VUs
    { duration: '3m', target: 30 },   // Stay at 30 VUs
    { duration: '1m', target: 50 },   // Ramp up to 50 VUs
    { duration: '3m', target: 50 },   // Stay at 50 VUs
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],

  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],  // 95% < 2s, 99% < 5s
    'http_req_failed': ['rate<0.05'],                   // Error rate < 5%
    'chat_response_time': ['p(95)<3000'],               // Chat API 95% < 3s
    'errors': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Test scenarios - different user journeys
const scenarios = [
  {
    name: 'Simple Trip Planning',
    messages: [
      'I want to plan a trip to Goa',
      'I\'m traveling from Delhi',
      'We\'ll be 2 people, traveling from December 15 to December 20',
    ],
  },
  {
    name: 'Flight Search',
    messages: [
      'Find flights from Delhi to Mumbai on January 10, returning January 15, 2 passengers, economy',
    ],
  },
  {
    name: 'City Without Airport',
    messages: [
      'Find flights from Nellore to Goa on December 20, 1 passenger, economy, one-way',
    ],
  },
  {
    name: 'Progressive Planning',
    messages: [
      'I need a flight to Bangalore',
      'From Mumbai, next week, 1 passenger, economy class',
    ],
  },
];

export default function () {
  const chatId = `load-test-${__VU}-${Date.now()}`;

  // Randomly pick a scenario
  const scenario = scenarios[randomIntBetween(0, scenarios.length - 1)];

  // Execute conversation
  const conversationHistory = [];

  for (const message of scenario.messages) {
    const payload = JSON.stringify({
      message: message,
      chatId: chatId,
      conversationHistory: conversationHistory,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/api/chat`, payload, params);
    const responseTime = Date.now() - startTime;

    chatResponseTime.add(responseTime);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'has response body': (r) => r.body && r.body.length > 0,
      'response time acceptable': (r) => r.timings.duration < 10000,
    });

    if (!success) {
      errorRate.add(1);
      console.error(`❌ Request failed: ${res.status}, VU: ${__VU}, Scenario: ${scenario.name}`);
    }

    // Update conversation history
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: body.response || body.finalOutput || '' }
        );
      } catch (e) {
        console.error('Failed to parse response:', e);
      }
    }

    // Think time between messages
    sleep(randomIntBetween(1, 3));
  }

  // Think time between scenarios
  sleep(randomIntBetween(2, 5));
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    [`load-tests/results/load-test-${timestamp}.json`]: JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  let output = '\n';

  output += `${indent}================================\n`;
  output += `${indent}     LOAD TEST SUMMARY\n`;
  output += `${indent}================================\n\n`;

  // Request stats
  if (data.metrics.http_reqs) {
    output += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  }

  // Duration stats
  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration.values;
    output += `${indent}Response Time:\n`;
    output += `${indent}  - Average: ${duration.avg.toFixed(2)}ms\n`;
    output += `${indent}  - Min: ${duration.min.toFixed(2)}ms\n`;
    output += `${indent}  - Max: ${duration.max.toFixed(2)}ms\n`;
    output += `${indent}  - p(95): ${duration['p(95)'].toFixed(2)}ms\n`;
    output += `${indent}  - p(99): ${duration['p(99)'].toFixed(2)}ms\n`;
  }

  // Error rate
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    output += `${indent}Error Rate: ${failRate}%\n`;
  }

  // VUs
  if (data.metrics.vus_max) {
    output += `${indent}Max VUs: ${data.metrics.vus_max.values.max}\n`;
  }

  output += `${indent}\n================================\n`;

  return output;
}
