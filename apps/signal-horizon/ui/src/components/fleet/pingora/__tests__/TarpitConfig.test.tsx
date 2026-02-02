/**
 * Tarpit Config Component Tests
 *
 * Tests for the Tarpit (slow-drip defense) configuration form component.
 * Covers: rendering, toggle behavior, validation, and onChange callbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TarpitConfig, type TarpitConfigData } from '../TarpitConfig';

const createDefaultConfig = (overrides: Partial<TarpitConfigData> = {}): TarpitConfigData => ({
  enabled: true,
  base_delay_ms: 500,
  max_delay_ms: 30000,
  progressive_multiplier: 1.5,
  max_concurrent_tarpits: 1000,
  decay_threshold_ms: 300000, // 5 minutes
  ...overrides,
});

describe('TarpitConfig', () => {
  describe('Rendering', () => {
    it('should render the component with title', () => {
      const config = createDefaultConfig();
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('Tarpit (Slow-Drip Defense)')).toBeInTheDocument();
      expect(screen.getByText(/Progressive delays/)).toBeInTheDocument();
    });

    it('should show config options when enabled', () => {
      const config = createDefaultConfig({ enabled: true });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByLabelText('Base Delay (ms)')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Delay (ms)')).toBeInTheDocument();
      expect(screen.getByLabelText('Progressive Multiplier')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Concurrent')).toBeInTheDocument();
    });

    it('should hide config options when disabled', () => {
      const config = createDefaultConfig({ enabled: false });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.queryByLabelText('Base Delay (ms)')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Max Delay (ms)')).not.toBeInTheDocument();
    });

    it('should display delay formula with current values', () => {
      const config = createDefaultConfig({
        base_delay_ms: 500,
        max_delay_ms: 30000,
        progressive_multiplier: 1.5,
      });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText(/500ms × 1\.5\^level/)).toBeInTheDocument();
      expect(screen.getByText(/30000ms/)).toBeInTheDocument();
    });
  });

  describe('Enable Toggle', () => {
    it('should call onChange with enabled=true when toggled on', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ enabled: false });
      render(<TarpitConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable Tarpit');
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should call onChange with enabled=false when toggled off', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ enabled: true });
      render(<TarpitConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable Tarpit');
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('Numeric Inputs', () => {
    it('should update base_delay_ms on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ base_delay_ms: 500 });
      render(<TarpitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Base Delay (ms)');
      fireEvent.change(input, { target: { value: '1000' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ base_delay_ms: 1000 })
      );
    });

    it('should update max_delay_ms on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ max_delay_ms: 30000 });
      render(<TarpitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Max Delay (ms)');
      fireEvent.change(input, { target: { value: '60000' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_delay_ms: 60000 })
      );
    });

    it('should update progressive_multiplier on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ progressive_multiplier: 1.5 });
      render(<TarpitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Progressive Multiplier');
      fireEvent.change(input, { target: { value: '2.0' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ progressive_multiplier: 2.0 })
      );
    });

    it('should update max_concurrent_tarpits on input change', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ max_concurrent_tarpits: 1000 });
      render(<TarpitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Max Concurrent');
      fireEvent.change(input, { target: { value: '5000' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_concurrent_tarpits: 5000 })
      );
    });

    it('should update decay_threshold_ms when changing minutes', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig({ decay_threshold_ms: 300000 }); // 5 minutes
      render(<TarpitConfig config={config} onChange={onChange} />);

      const input = screen.getByLabelText('Decay Threshold (minutes)');
      fireEvent.change(input, { target: { value: '10' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ decay_threshold_ms: 600000 }) // 10 minutes
      );
    });
  });

  describe('Validation', () => {
    it('should show validation error when base delay exceeds max delay', () => {
      const config = createDefaultConfig({
        base_delay_ms: 40000,
        max_delay_ms: 30000,
      });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('Configuration has validation errors')).toBeInTheDocument();
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });

    it('should show validation error when base delay equals max delay', () => {
      const config = createDefaultConfig({
        base_delay_ms: 30000,
        max_delay_ms: 30000,
      });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText('Configuration has validation errors')).toBeInTheDocument();
    });

    it('should show validation error when multiplier is less than 1', () => {
      const config = createDefaultConfig({
        progressive_multiplier: 0.5,
      });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.getByText(/Multiplier should be >= 1/)).toBeInTheDocument();
    });

    it('should not show validation error when configuration is valid', () => {
      const config = createDefaultConfig({
        base_delay_ms: 500,
        max_delay_ms: 30000,
        progressive_multiplier: 1.5,
      });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      expect(screen.queryByText('Configuration has validation errors')).not.toBeInTheDocument();
    });

    it('should mark invalid fields with aria-invalid', () => {
      const config = createDefaultConfig({
        base_delay_ms: 40000,
        max_delay_ms: 30000,
      });
      render(<TarpitConfig config={config} onChange={vi.fn()} />);

      const baseDelayInput = screen.getByLabelText('Base Delay (ms)');
      expect(baseDelayInput).toHaveAttribute('aria-invalid', 'true');

      const maxDelayInput = screen.getByLabelText('Max Delay (ms)');
      expect(maxDelayInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('onChange Data Structure', () => {
    it('should call onChange with complete config object', () => {
      const onChange = vi.fn();
      const config = createDefaultConfig();
      render(<TarpitConfig config={config} onChange={onChange} />);

      const toggle = screen.getByLabelText('Enable Tarpit');
      fireEvent.click(toggle);

      const call = onChange.mock.calls[0][0];
      expect(call).toHaveProperty('enabled');
      expect(call).toHaveProperty('base_delay_ms');
      expect(call).toHaveProperty('max_delay_ms');
      expect(call).toHaveProperty('progressive_multiplier');
      expect(call).toHaveProperty('max_concurrent_tarpits');
      expect(call).toHaveProperty('decay_threshold_ms');
    });
  });
});
