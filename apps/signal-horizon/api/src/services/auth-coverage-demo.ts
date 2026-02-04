/**
 * Demo data generator for Auth Coverage Map
 * Generates realistic endpoint statistics for documentation and screenshots
 */

import { AuthCoverageSummary, EndpointAuthStats } from '../schemas/auth-coverage.js';

interface DemoEndpoint {
  endpoint: string;
  method: string;
  totalRequests: number;
  successCount: number;
  unauthorizedCount: number;
  forbiddenCount: number;
  otherErrorCount: number;
  requestsWithAuth: number;
  requestsWithoutAuth: number;
}

export class AuthCoverageDemoGenerator {
  /**
   * Generate realistic demo data showcasing various risk levels and patterns
   */
  static generateDemoEndpoints(): EndpointAuthStats[] {
    const endpoints: DemoEndpoint[] = [
      // HIGH RISK: Admin endpoints without auth
      {
        endpoint: 'POST /admin/users',
        method: 'POST',
        totalRequests: 2400,
        successCount: 2350,
        unauthorizedCount: 5,
        forbiddenCount: 5,
        otherErrorCount: 40,
        requestsWithAuth: 450,
        requestsWithoutAuth: 1950,
      },
      {
        endpoint: 'GET /admin/settings',
        method: 'GET',
        totalRequests: 5600,
        successCount: 5400,
        unauthorizedCount: 80,
        forbiddenCount: 40,
        otherErrorCount: 80,
        requestsWithAuth: 800,
        requestsWithoutAuth: 4800,
      },
      {
        endpoint: 'DELETE /admin/sessions',
        method: 'DELETE',
        totalRequests: 1200,
        successCount: 1050,
        unauthorizedCount: 100,
        forbiddenCount: 50,
        otherErrorCount: 0,
        requestsWithAuth: 200,
        requestsWithoutAuth: 1000,
      },
      // HIGH RISK: Internal endpoints exposed
      {
        endpoint: 'GET /internal/metrics',
        method: 'GET',
        totalRequests: 8900,
        successCount: 8500,
        unauthorizedCount: 250,
        forbiddenCount: 100,
        otherErrorCount: 50,
        requestsWithAuth: 1200,
        requestsWithoutAuth: 7700,
      },
      // MEDIUM RISK: Inconsistent auth enforcement
      {
        endpoint: 'POST /api/v1/accounts',
        method: 'POST',
        totalRequests: 3400,
        successCount: 3100,
        unauthorizedCount: 150,
        forbiddenCount: 80,
        otherErrorCount: 70,
        requestsWithAuth: 2100,
        requestsWithoutAuth: 1300,
      },
      {
        endpoint: 'GET /api/v1/users/:id/profile',
        method: 'GET',
        totalRequests: 6200,
        successCount: 5800,
        unauthorizedCount: 200,
        forbiddenCount: 150,
        otherErrorCount: 50,
        requestsWithAuth: 4200,
        requestsWithoutAuth: 2000,
      },
      // MEDIUM RISK: Payment endpoints with gaps
      {
        endpoint: 'POST /api/v1/billing/invoice',
        method: 'POST',
        totalRequests: 2800,
        successCount: 2600,
        unauthorizedCount: 120,
        forbiddenCount: 60,
        otherErrorCount: 20,
        requestsWithAuth: 1800,
        requestsWithoutAuth: 1000,
      },
      // LOW RISK: Well-protected endpoints
      {
        endpoint: 'GET /api/v1/public/health',
        method: 'GET',
        totalRequests: 24000,
        successCount: 23960,
        unauthorizedCount: 5,
        forbiddenCount: 5,
        otherErrorCount: 30,
        requestsWithAuth: 100,
        requestsWithoutAuth: 23900,
      },
      {
        endpoint: 'GET /api/v1/threats/list',
        method: 'GET',
        totalRequests: 15600,
        successCount: 15400,
        unauthorizedCount: 80,
        forbiddenCount: 80,
        otherErrorCount: 40,
        requestsWithAuth: 15200,
        requestsWithoutAuth: 400,
      },
      {
        endpoint: 'POST /api/v1/auth/login',
        method: 'POST',
        totalRequests: 42000,
        successCount: 41500,
        unauthorizedCount: 300,
        forbiddenCount: 100,
        otherErrorCount: 100,
        requestsWithAuth: 5000,
        requestsWithoutAuth: 37000,
      },
      // LOW RISK: Properly authenticated
      {
        endpoint: 'PUT /api/v1/settings/profile',
        method: 'PUT',
        totalRequests: 3200,
        successCount: 3100,
        unauthorizedCount: 50,
        forbiddenCount: 40,
        otherErrorCount: 10,
        requestsWithAuth: 3100,
        requestsWithoutAuth: 100,
      },
      {
        endpoint: 'DELETE /api/v1/resources/:id',
        method: 'DELETE',
        totalRequests: 1800,
        successCount: 1750,
        unauthorizedCount: 30,
        forbiddenCount: 15,
        otherErrorCount: 5,
        requestsWithAuth: 1780,
        requestsWithoutAuth: 20,
      },
      // UNKNOWN/INSUFFICIENT DATA
      {
        endpoint: 'GET /api/v2/beta/feature',
        method: 'GET',
        totalRequests: 45,
        successCount: 40,
        unauthorizedCount: 3,
        forbiddenCount: 2,
        otherErrorCount: 0,
        requestsWithAuth: 35,
        requestsWithoutAuth: 10,
      },
      {
        endpoint: 'POST /api/v2/experimental/analytics',
        method: 'POST',
        totalRequests: 82,
        successCount: 78,
        unauthorizedCount: 2,
        forbiddenCount: 1,
        otherErrorCount: 1,
        requestsWithAuth: 60,
        requestsWithoutAuth: 22,
      },
      // SHADOW API: Authenticated traffic without enforcement
      {
        endpoint: 'GET /api/internal/debug',
        method: 'GET',
        totalRequests: 450,
        successCount: 430,
        unauthorizedCount: 5,
        forbiddenCount: 10,
        otherErrorCount: 5,
        requestsWithAuth: 400,
        requestsWithoutAuth: 50,
      },
    ];

    return endpoints.map((ep) => {
      const denialCount = ep.unauthorizedCount + ep.forbiddenCount;
      const denialRate = ep.totalRequests > 0 ? denialCount / ep.totalRequests : 0;
      const authRate =
        ep.totalRequests > 0
          ? ep.requestsWithAuth / ep.totalRequests
          : 0;

      let authPattern: 'none' | 'optional' | 'required' | 'shadow_api' =
        'insufficient_data' as any;
      let riskLevel: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';

      // Classify based on request patterns
      if (ep.totalRequests < 100) {
        riskLevel = 'unknown';
        authPattern = 'insufficient_data' as any;
      } else if (
        ep.endpoint.includes('/admin') ||
        ep.endpoint.includes('/internal')
      ) {
        // Admin/internal endpoints without proper auth = HIGH RISK
        if (authRate < 0.3) {
          riskLevel = 'high';
          authPattern = denialRate > 0.005 ? 'optional' : 'none';
        } else {
          riskLevel = 'medium';
          authPattern = 'optional';
        }
      } else if (
        ep.endpoint.includes('/billing') ||
        ep.endpoint.includes('/payment') ||
        ep.endpoint.includes('/accounts')
      ) {
        // Sensitive endpoints
        if (authRate < 0.5) {
          riskLevel = 'high';
          authPattern = 'optional';
        } else if (denialRate < 0.005) {
          riskLevel = 'medium';
          authPattern = 'optional';
        } else {
          riskLevel = 'low';
          authPattern = 'required';
        }
      } else if (ep.endpoint.includes('/public') || ep.endpoint === 'GET /api/v1/public/health') {
        riskLevel = 'low';
        authPattern = 'none';
      } else if (ep.endpoint.includes('/beta') || ep.endpoint.includes('/v2')) {
        riskLevel = 'unknown';
        authPattern = 'insufficient_data' as any;
      } else if (authRate > 0.8 && denialRate > 0.005) {
        // Shadow API: mostly authenticated but has denials
        riskLevel = 'medium';
        authPattern = 'shadow_api';
      } else if (authRate > 0.8) {
        riskLevel = 'low';
        authPattern = 'required';
      } else {
        riskLevel = 'medium';
        authPattern = 'optional';
      }

      return {
        endpoint: ep.endpoint,
        method: ep.method,
        totalRequests: ep.totalRequests,
        denialRate,
        authRate,
        authPattern,
        riskLevel,
        requestsWithAuth: ep.requestsWithAuth,
        requestsWithoutAuth: ep.requestsWithoutAuth,
      };
    });
  }

  /**
   * Generate demo summary statistics
   */
  static generateDemoSummary() {
    const endpoints = this.generateDemoEndpoints();

    const totalEndpoints = endpoints.length;
    const highRiskCount = endpoints.filter(
      (e) => e.riskLevel === 'high'
    ).length;
    const mediumRiskCount = endpoints.filter(
      (e) => e.riskLevel === 'medium'
    ).length;
    const lowRiskCount = endpoints.filter((e) => e.riskLevel === 'low').length;
    const unknownCount = endpoints.filter(
      (e) => e.riskLevel === 'unknown'
    ).length;

    const shadowApiCount = endpoints.filter(
      (e) => e.authPattern === 'shadow_api'
    ).length;
    const totalRequests = endpoints.reduce((sum, e) => sum + e.totalRequests, 0);
    const totalDenials = endpoints.reduce(
      (sum, e) => sum + Math.floor(e.denialRate * e.totalRequests),
      0
    );

    return {
      totalEndpoints,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      unknownCount,
      shadowApiCount,
      totalRequests,
      totalDenials,
      averageDenialRate: totalRequests > 0 ? totalDenials / totalRequests : 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate multi-tenant demo data
   */
  static generateMultiTenantDemoData(): AuthCoverageSummary[] {
    const tenants = [
      { id: 'tenant-acme', name: 'ACME Corp' },
      { id: 'tenant-secure', name: 'SecureBank' },
      { id: 'tenant-startup', name: 'StartupXYZ' },
    ];

    return tenants.map((tenant) => ({
      tenant_id: tenant.id,
      timestamp: Math.floor(Date.now() / 1000),
      endpoints: [
        {
          endpoint: 'GET /api/v1/profile',
          counts: {
            total: 5000 + Math.random() * 5000,
            success: 4800 + Math.random() * 4000,
            unauthorized: Math.random() * 100,
            forbidden: Math.random() * 50,
            other_error: Math.random() * 50,
            with_auth: 3000 + Math.random() * 2000,
            without_auth: 1000 + Math.random() * 2000,
          },
        },
        {
          endpoint: 'POST /api/v1/data',
          counts: {
            total: 2000 + Math.random() * 3000,
            success: 1800 + Math.random() * 2700,
            unauthorized: Math.random() * 80,
            forbidden: Math.random() * 40,
            other_error: Math.random() * 30,
            with_auth: 1800 + Math.random() * 1500,
            without_auth: 200 + Math.random() * 1000,
          },
        },
        {
          endpoint: 'DELETE /admin/resources',
          counts: {
            total: 500 + Math.random() * 1000,
            success: 400 + Math.random() * 800,
            unauthorized: Math.random() * 60,
            forbidden: Math.random() * 30,
            other_error: Math.random() * 20,
            with_auth: 300 + Math.random() * 400,
            without_auth: 200 + Math.random() * 400,
          },
        },
      ],
    }));
  }
}
