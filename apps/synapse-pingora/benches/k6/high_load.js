import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    constant_request_rate: {
      executor: 'constant-arrival-rate',
      rate: 5000, // Start with 5000 RPS
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:6190';

export default function () {
  // Rotate through different endpoint patterns to test profiling
  const endpoints = [
    '/api/v1/users/123',
    '/api/v1/users/456',
    '/api/v1/products/abc-def-ghi',
    '/api/v1/orders/ORD-999',
    '/api/v1/status',
  ];
  
  const url = `${BASE_URL}${endpoints[Math.floor(Math.random() * endpoints.length)]}`;
  
  const res = http.get(url);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
