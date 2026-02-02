/**
 * DLP Config Component Tests
 *
 * Tests for the DLP (Data Loss Prevention) configuration form component.
 * Covers: rendering, toggle behavior, validation, and onChange callbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DlpConfig, type DlpConfigData } from '../DlpConfig';

const createDefaultConfig = (overrides: Partial<DlpConfigData> = {}): DlpConfigData => ({
  enabled: true,
  fast_mode: false,
  scan_text_only: false,
  max_scan_size: 10 * 1024 * 1024, // 10MB
  max_body_inspection_bytes: 32 * 1024, // 32KB
  max_matches: 100,
  custom_keywords: [],
  ...overrides,
});

describe('DlpConfig', () => {
  describe('Rendering', () => {
    it('should render the component with title', () => {
      const config = createDefaultConfig();
      render(<DlpConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('DLP Scanner')).toBeInTheDocument();
      expect(screen.getByText(/Data Loss Prevention/)).toBeInTheDocument();
    });

    it('should show config options when enabled', () => {
      const config = createDefaultConfig({ enabled: true });
      render(<DlpConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('Fast Mode (critical patterns only)')).toBeInTheDocument();
      expect(screen.getByText('Scan text content only')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Scan Size (MB)')).toBeInTheDocument();
    });

    it('should hide config options when disabled', () => {
      const config = createDefaultConfig({ enabled: false });
      render(<DlpConfig config={config} onChange={vi.fn()} />);

      expect(screen.queryByText('Fast Mode (critical patterns only)')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Max Scan Size (MB)')).not.toBeInTheDocument();
    });
  });

  describe('Enable Toggle', () => {
    it('should call onChange with enabled=true when toggled on', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ enabled: false });
      render(<DlpConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable DLP Scanner');
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should call onChange with enabled=false when toggled off', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ enabled: true });
      render(<DlpConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable DLP Scanner');
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('Mode Toggles', () => {
    it('should toggle fast_mode when checkbox clicked', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ fast_mode: false });
      render(<DlpConfig config={config} onChange={onChange} />);

      const checkbox = screen.getByRole('checkbox', { name: /fast mode/i });
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ fast_mode: true })
      );
    });

    it('should toggle scan_text_only when checkbox clicked', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ scan_text_only: false });
      render(<DlpConfig config={config} onChange={onChange} />);

      const checkbox = screen.getByRole('checkbox', { name: /scan text content only/i });
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ scan_text_only: true })
      );
    });
  });

  describe('Numeric Inputs', () => {
    it('should update max_scan_size on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ max_scan_size: 10 * 1024 * 1024 });
      render(<DlpConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Max Scan Size (MB)');
      fireEvent.change(input, { target: { value: '20' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_scan_size: 20 * 1024 * 1024 })
      );
    });

    it('should update max_body_inspection_bytes on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ max_body_inspection_bytes: 32 * 1024 });
      render(<DlpConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Inspect Bytes (KB)');
      fireEvent.change(input, { target: { value: '64' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_body_inspection_bytes: 64 * 1024 })
      );
    });

    it('should update max_matches on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ max_matches: 100 });
      render(<DlpConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Max Matches');
      fireEvent.change(input, { target: { value: '500' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_matches: 500 })
      );
    });
  });

  describe('Validation', () => {
    it('should show validation error when inspect bytes exceeds max scan size', () => {
      const config = createDefaultConfig({
        max_scan_size: 1 * 1024 * 1024, // 1MB
        max_body_inspection_bytes: 2 * 1024 * 1024, // 2MB - exceeds max scan
      });
      render(<DlpConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('Configuration has validation errors')).toBeInTheDocument();
      // Multiple alerts are shown (one for each invalid field)
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });

    it('should not show validation error when configuration is valid', () => {
      const config = createDefaultConfig({
        max_scan_size: 10 * 1024 * 1024, // 10MB
        max_body_inspection_bytes: 32 * 1024, // 32KB - within limits
      });
      render(<DlpConfig config={config} onChange={vi.fn()} />);

      expect(screen.queryByText('Configuration has validation errors')).not.toBeInTheDocument();
    });

    it('should mark invalid fields with aria-invalid', () => {
      const config = createDefaultConfig({
        max_scan_size: 1 * 1024 * 1024, // 1MB
        max_body_inspection_bytes: 2 * 1024 * 1024, // Exceeds
      });
      render(<DlpConfig config={config} onChange={vi.fn()} />);

      const scanSizeInput = screen.getByLabelText('Max Scan Size (MB)');
      expect(scanSizeInput).toHaveAttribute('aria-invalid', 'true');

      const inspectBytesInput = screen.getByLabelText('Inspect Bytes (KB)');
      expect(inspectBytesInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Custom Keywords', () => {
    it('should display existing keywords as comma-separated', () => {
      const config = createDefaultConfig({
        custom_keywords: ['secret', 'confidential', 'api-key'],
      });
      render(<DlpConfig config={config} onChange={vi.fn()} />);

      const input = screen.getByLabelText('Custom Keywords (comma-separated)');
      expect(input).toHaveValue('secret, confidential, api-key');
    });

    it('should parse comma-separated input into array', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ custom_keywords: [] });
      render(<DlpConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Custom Keywords (comma-separated)');
      fireEvent.change(input, { target: { value: 'password, secret, token' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_keywords: ['password', 'secret', 'token'],
        })
      );
    });

    it('should trim whitespace from keywords', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ custom_keywords: [] });
      render(<DlpConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Custom Keywords (comma-separated)');
      fireEvent.change(input, { target: { value: '  key1  ,  key2  ,  key3  ' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_keywords: ['key1', 'key2', 'key3'],
        })
      );
    });

    it('should filter out empty keywords', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ custom_keywords: [] });
      render(<DlpConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Custom Keywords (comma-separated)');
      fireEvent.change(input, { target: { value: 'key1,,,key2,   ,key3' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_keywords: ['key1', 'key2', 'key3'],
        })
      );
    });
  });

  describe('onChange Data Structure', () => {
    it('should call onChange with complete config object', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig();
      render(<DlpConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable DLP Scanner');
      fireEvent.click(toggle);

      const call = onChange.mock.calls[0][0];
      expect(call).toHaveProperty('enabled');
      expect(call).toHaveProperty('fast_mode');
      expect(call).toHaveProperty('scan_text_only');
      expect(call).toHaveProperty('max_scan_size');
      expect(call).toHaveProperty('max_body_inspection_bytes');
      expect(call).toHaveProperty('max_matches');
      expect(call).toHaveProperty('custom_keywords');
    });
  });
});
