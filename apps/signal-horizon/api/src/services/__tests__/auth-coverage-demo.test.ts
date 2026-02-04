import { describe, it, expect } from 'vitest';
import { AuthCoverageDemoGenerator } from '../auth-coverage-demo.js';

describe('AuthCoverageDemoGenerator', () => {
  describe('generateDemoEndpoints', () => {
    it('should generate demo endpoints', () => {
      const endpoints = AuthCoverageDemoGenerator.generateDemoEndpoints();

      expect(endpoints).toBeDefined();
      expect(endpoints.length).toBeGreaterThan(0);
    });

    it('should include high, medium, and low risk endpoints', () => {
      const endpoints = AuthCoverageDemoGenerator.generateDemoEndpoints();

      const highRisk = endpoints.filter(e => e.riskLevel === 'high');
      const mediumRisk = endpoints.filter(e => e.riskLevel === 'medium');
      const lowRisk = endpoints.filter(e => e.riskLevel === 'low');
      const unknown = endpoints.filter(e => e.riskLevel === 'unknown');

      expect(highRisk.length).toBeGreaterThan(0);
      expect(mediumRisk.length).toBeGreaterThan(0);
      expect(lowRisk.length).toBeGreaterThan(0);
      expect(unknown.length).toBeGreaterThan(0);
    });

    it('should include various auth patterns', () => {
      const endpoints = AuthCoverageDemoGenerator.generateDemoEndpoints();

      const nonePattern = endpoints.filter(e => e.authPattern === 'none');
      const optionalPattern = endpoints.filter(e => e.authPattern === 'optional');
      const requiredPattern = endpoints.filter(e => e.authPattern === 'required');
      const shadowApi = endpoints.filter(e => e.authPattern === 'shadow_api');

      expect(nonePattern.length).toBeGreaterThan(0);
      expect(optionalPattern.length).toBeGreaterThan(0);
      expect(requiredPattern.length).toBeGreaterThan(0);
      expect(shadowApi.length).toBeGreaterThan(0);
    });

    it('should have realistic request volumes', () => {
      const endpoints = AuthCoverageDemoGenerator.generateDemoEndpoints();

      endpoints.forEach((ep) => {
        expect(ep.totalRequests).toBeGreaterThan(0);
        expect(ep.requestsWithAuth).toBeLessThanOrEqual(ep.totalRequests);
        expect(ep.requestsWithoutAuth).toBeLessThanOrEqual(ep.totalRequests);
      });
    });

    it('should have valid denial rates', () => {
      const endpoints = AuthCoverageDemoGenerator.generateDemoEndpoints();

      endpoints.forEach((ep) => {
        expect(ep.denialRate).toBeGreaterThanOrEqual(0);
        expect(ep.denialRate).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid auth rates', () => {
      const endpoints = AuthCoverageDemoGenerator.generateDemoEndpoints();

      endpoints.forEach((ep) => {
        expect(ep.authRate).toBeGreaterThanOrEqual(0);
        expect(ep.authRate).toBeLessThanOrEqual(1);
      });
    });

    it('should have consistent endpoint and method fields', () => {
      const endpoints = AuthCoverageDemoGenerator.generateDemoEndpoints();

      endpoints.forEach((ep) => {
        expect(ep.endpoint).toBeDefined();
        expect(ep.endpoint.length).toBeGreaterThan(0);
        expect(ep.method).toBeDefined();
      });
    });
  });

  describe('generateDemoSummary', () => {
    it('should generate demo summary statistics', () => {
      const summary = AuthCoverageDemoGenerator.generateDemoSummary();

      expect(summary).toBeDefined();
      expect(summary.totalEndpoints).toBeGreaterThan(0);
      expect(summary.highRiskCount).toBeGreaterThanOrEqual(0);
      expect(summary.mediumRiskCount).toBeGreaterThanOrEqual(0);
      expect(summary.lowRiskCount).toBeGreaterThanOrEqual(0);
      expect(summary.unknownCount).toBeGreaterThanOrEqual(0);
    });

    it('should have valid risk counts', () => {
      const summary = AuthCoverageDemoGenerator.generateDemoSummary();

      const totalRisks = summary.highRiskCount + summary.mediumRiskCount + summary.lowRiskCount + summary.unknownCount;
      expect(totalRisks).toBe(summary.totalEndpoints);
    });

    it('should have realistic totals', () => {
      const summary = AuthCoverageDemoGenerator.generateDemoSummary();

      expect(summary.totalRequests).toBeGreaterThan(0);
      expect(summary.totalDenials).toBeGreaterThanOrEqual(0);
      expect(summary.totalDenials).toBeLessThanOrEqual(summary.totalRequests);
    });

    it('should have valid denial rate', () => {
      const summary = AuthCoverageDemoGenerator.generateDemoSummary();

      expect(summary.averageDenialRate).toBeGreaterThanOrEqual(0);
      expect(summary.averageDenialRate).toBeLessThanOrEqual(1);
    });

    it('should include shadow API count', () => {
      const summary = AuthCoverageDemoGenerator.generateDemoSummary();

      expect(summary.shadowApiCount).toBeGreaterThanOrEqual(0);
    });

    it('should have lastUpdated timestamp', () => {
      const summary = AuthCoverageDemoGenerator.generateDemoSummary();

      expect(summary.lastUpdated).toBeDefined();
      const date = new Date(summary.lastUpdated);
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('generateMultiTenantDemoData', () => {
    it('should generate multi-tenant demo data', () => {
      const data = AuthCoverageDemoGenerator.generateMultiTenantDemoData();

      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
    });

    it('should have different tenant IDs', () => {
      const data = AuthCoverageDemoGenerator.generateMultiTenantDemoData();

      const tenantIds = data.map(d => d.tenant_id);
      const uniqueIds = new Set(tenantIds);
      expect(uniqueIds.size).toBeGreaterThan(1);
    });

    it('should have endpoints for each tenant', () => {
      const data = AuthCoverageDemoGenerator.generateMultiTenantDemoData();

      data.forEach((tenantData) => {
        expect(tenantData.endpoints).toBeDefined();
        expect(tenantData.endpoints.length).toBeGreaterThan(0);
      });
    });

    it('should have valid timestamps', () => {
      const data = AuthCoverageDemoGenerator.generateMultiTenantDemoData();

      data.forEach((tenantData) => {
        expect(tenantData.timestamp).toBeGreaterThan(0);
      });
    });
  });
});
