/**
 * Rate Limit Config Component Tests
 *
 * Tests for the Rate Limiting configuration form component.
 * Covers: rendering, toggle behavior, and onChange callbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RateLimitConfig, type RateLimitData } from '../RateLimitConfig';

const createDefaultConfig = (overrides: Partial<RateLimitData> = {}): RateLimitData => ({
  enabled: true,
  requests_per_second: 100,
  burst: 200,
  ...overrides,
});

describe('RateLimitConfig', () => {
  describe('Rendering', () => {
    it('should render the component with title', () => {
      const config = createDefaultConfig();
      render(<RateLimitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('Rate Limiting')).toBeInTheDocument();
      expect(screen.getByText(/Global request throttling/)).toBeInTheDocument();
    });

    it('should show config options when enabled', () => {
      const config = createDefaultConfig({ enabled: true });
      render(<RateLimitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByLabelText('Requests / Sec')).toBeInTheDocument();
      expect(screen.getByLabelText('Burst Capacity')).toBeInTheDocument();
    });

    it('should hide config options when disabled', () => {
      const config = createDefaultConfig({ enabled: false });
      render(<RateLimitConfig config={config} onChange={vi.fn()} />);

      expect(screen.queryByLabelText('Requests / Sec')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Burst Capacity')).not.toBeInTheDocument();
    });

    it('should display summary text with current values', () => {
      const config = createDefaultConfig({
        requests_per_second: 150,
        burst: 300,
      });
      render(<RateLimitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('150 RPS')).toBeInTheDocument();
      expect(screen.getByText('300 requests')).toBeInTheDocument();
    });
  });

  describe('Enable Toggle', () => {
    it('should call onChange with enabled=true when toggled on', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ enabled: false });
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable Rate Limiting');
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should call onChange with enabled=false when toggled off', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ enabled: true });
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable Rate Limiting');
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('Numeric Inputs', () => {
    it('should update requests_per_second on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ requests_per_second: 100 });
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Requests / Sec');
      fireEvent.change(input, { target: { value: '500' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ requests_per_second: 500 })
      );
    });

    it('should update burst on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ burst: 200 });
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Burst Capacity');
      fireEvent.change(input, { target: { value: '1000' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ burst: 1000 })
      );
    });

    it('should default to 1 for invalid requests_per_second', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig();
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Requests / Sec');
      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ requests_per_second: 1 })
      );
    });

    it('should default to 1 for invalid burst', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig();
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Burst Capacity');
      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ burst: 1 })
      );
    });
  });

  describe('onChange Data Structure', () => {
    it('should call onChange with complete config object', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig();
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable Rate Limiting');
      fireEvent.click(toggle);

      const call = onChange.mock.calls[0][0];
      expect(call).toHaveProperty('enabled');
      expect(call).toHaveProperty('requests_per_second');
      expect(call).toHaveProperty('burst');
    });

    it('should preserve other fields when updating single value', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({
        requests_per_second: 100,
        burst: 200,
      });
      render(<RateLimitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Requests / Sec');
      fireEvent.change(input, { target: { value: '500' } });

      expect(onChange).toHaveBeenCalledWith({
        enabled: true,
        requests_per_second: 500,
        burst: 200,
      });
    });
  });
});
