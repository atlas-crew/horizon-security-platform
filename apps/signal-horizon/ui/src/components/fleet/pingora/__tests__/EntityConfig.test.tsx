/**
 * Entity Config Component Tests
 *
 * Tests for the Entity Store and Impossible Travel configuration form component.
 * Covers: rendering, toggle behavior, validation, and onChange callbacks for both configs.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityConfig, type EntityConfigData, type TravelConfigData } from '../EntityConfig';

const createDefaultEntityConfig = (overrides: Partial<EntityConfigData> = {}): EntityConfigData => ({
  enabled: true,
  max_entities: 100000,
  risk_decay_per_minute: 5,
  block_threshold: 80,
  max_risk: 100,
  max_rules_per_entity: 50,
  ...overrides,
});

const createDefaultTravelConfig = (overrides: Partial<TravelConfigData> = {}): TravelConfigData => ({
  max_speed_kmh: 800,
  min_distance_km: 100,
  history_window_ms: 86400000, // 24 hours
  max_history_per_user: 100,
  ...overrides,
});

describe('EntityConfig', () => {
  describe('Entity Store Rendering', () => {
    it('should render the Entity Store section with title', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      expect(screen.getByText('Entity Store')).toBeInTheDocument();
      expect(screen.getByText(/Per-IP risk tracking/)).toBeInTheDocument();
    });

    it('should show entity config options when enabled', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({ enabled: true })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Max Entities')).toBeInTheDocument();
      expect(screen.getByText('Block Threshold')).toBeInTheDocument();
      expect(screen.getByText('Max Risk Score')).toBeInTheDocument();
    });

    it('should hide entity config options when disabled', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({ enabled: false })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Max Entities')).not.toBeInTheDocument();
      expect(screen.queryByText('Block Threshold')).not.toBeInTheDocument();
    });
  });

  describe('Impossible Travel Rendering', () => {
    it('should render the Impossible Travel section', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      expect(screen.getByText('Impossible Travel Detection')).toBeInTheDocument();
      expect(screen.getByText(/geographically impossible/)).toBeInTheDocument();
    });

    it('should always show travel config options (no toggle)', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({ enabled: false })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      // Travel config should be visible even when entity is disabled
      expect(screen.getByText('Max Speed (km/h)')).toBeInTheDocument();
      expect(screen.getByText('Min Distance (km)')).toBeInTheDocument();
    });
  });

  describe('Entity Toggle', () => {
    it('should call onEntityChange with enabled=true when toggled on', () => {
      const onEntityChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({ enabled: false })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={onEntityChange}
          onTravelChange={vi.fn()}
        />
      );

      const toggle = screen.getByLabelText('Enable Entity Store');
      fireEvent.click(toggle);

      expect(onEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should call onEntityChange with enabled=false when toggled off', () => {
      const onEntityChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({ enabled: true })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={onEntityChange}
          onTravelChange={vi.fn()}
        />
      );

      const toggle = screen.getByLabelText('Enable Entity Store');
      fireEvent.click(toggle);

      expect(onEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('Entity Numeric Inputs', () => {
    it('should update max_entities on input change', () => {
      const onEntityChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={onEntityChange}
          onTravelChange={vi.fn()}
        />
      );

      const input = screen.getByLabelText('Max Entities');
      fireEvent.change(input, { target: { value: '500000' } });

      expect(onEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_entities: 500000 })
      );
    });

    it('should update max_rules_per_entity on input change', () => {
      const onEntityChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={onEntityChange}
          onTravelChange={vi.fn()}
        />
      );

      const input = screen.getByText('Max Rules Per Entity').parentElement!.querySelector('input')!;
      fireEvent.change(input, { target: { value: '100' } });

      expect(onEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_rules_per_entity: 100 })
      );
    });
  });

  describe('Travel Numeric Inputs', () => {
    it('should update max_speed_kmh on input change', () => {
      const onTravelChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={onTravelChange}
        />
      );

      const input = screen.getByText('Max Speed (km/h)').parentElement!.querySelector('input')!;
      fireEvent.change(input, { target: { value: '1000' } });

      expect(onTravelChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_speed_kmh: 1000 })
      );
    });

    it('should update min_distance_km on input change', () => {
      const onTravelChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={onTravelChange}
        />
      );

      const input = screen.getByText('Min Distance (km)').parentElement!.querySelector('input')!;
      fireEvent.change(input, { target: { value: '500' } });

      expect(onTravelChange).toHaveBeenCalledWith(
        expect.objectContaining({ min_distance_km: 500 })
      );
    });

    it('should update history_window_ms when changing hours', () => {
      const onTravelChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig({ history_window_ms: 86400000 })}
          onEntityChange={vi.fn()}
          onTravelChange={onTravelChange}
        />
      );

      const input = screen.getByText('History Window (hours)').parentElement!.querySelector('input')!;
      fireEvent.change(input, { target: { value: '48' } });

      expect(onTravelChange).toHaveBeenCalledWith(
        expect.objectContaining({ history_window_ms: 48 * 3600000 })
      );
    });

    it('should update max_history_per_user on input change', () => {
      const onTravelChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={onTravelChange}
        />
      );

      const input = screen.getByText('Max History/User').parentElement!.querySelector('input')!;
      fireEvent.change(input, { target: { value: '200' } });

      expect(onTravelChange).toHaveBeenCalledWith(
        expect.objectContaining({ max_history_per_user: 200 })
      );
    });
  });

  describe('Validation', () => {
    it('should show validation error when block threshold exceeds max risk', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({
            block_threshold: 150,
            max_risk: 100,
          })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      expect(screen.getByText('Configuration has validation errors')).toBeInTheDocument();
      expect(screen.getByText(/Block threshold cannot exceed max risk/)).toBeInTheDocument();
    });

    it('should not show validation error when configuration is valid', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({
            block_threshold: 80,
            max_risk: 100,
          })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      expect(screen.queryByText('Configuration has validation errors')).not.toBeInTheDocument();
    });

    it('should not show validation error when entity is disabled', () => {
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig({
            enabled: false,
            block_threshold: 150,
            max_risk: 100,
          })}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={vi.fn()}
        />
      );

      expect(screen.queryByText('Configuration has validation errors')).not.toBeInTheDocument();
    });
  });

  describe('onChange Data Structure', () => {
    it('should call onEntityChange with complete entity config object', () => {
      const onEntityChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={onEntityChange}
          onTravelChange={vi.fn()}
        />
      );

      const toggle = screen.getByLabelText('Enable Entity Store');
      fireEvent.click(toggle);

      const call = onEntityChange.mock.calls[0][0];
      expect(call).toHaveProperty('enabled');
      expect(call).toHaveProperty('max_entities');
      expect(call).toHaveProperty('risk_decay_per_minute');
      expect(call).toHaveProperty('block_threshold');
      expect(call).toHaveProperty('max_risk');
      expect(call).toHaveProperty('max_rules_per_entity');
    });

    it('should call onTravelChange with complete travel config object', () => {
      const onTravelChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={vi.fn()}
          onTravelChange={onTravelChange}
        />
      );

      const input = screen.getByText('Max History/User').parentElement!.querySelector('input')!;
      fireEvent.change(input, { target: { value: '200' } });

      const call = onTravelChange.mock.calls[0][0];
      expect(call).toHaveProperty('max_speed_kmh');
      expect(call).toHaveProperty('min_distance_km');
      expect(call).toHaveProperty('history_window_ms');
      expect(call).toHaveProperty('max_history_per_user');
    });

    it('should not mix entity and travel onChange callbacks', () => {
      const onEntityChange = vi.fn();
      const onTravelChange = vi.fn();
      render(
        <EntityConfig
          entityConfig={createDefaultEntityConfig()}
          travelConfig={createDefaultTravelConfig()}
          onEntityChange={onEntityChange}
          onTravelChange={onTravelChange}
        />
      );

      // Change entity field
      const entityInput = screen.getByLabelText('Max Entities');
      fireEvent.change(entityInput, { target: { value: '500000' } });

      expect(onEntityChange).toHaveBeenCalled();
      expect(onTravelChange).not.toHaveBeenCalled();

      onEntityChange.mockClear();
      onTravelChange.mockClear();

      // Change travel field
      const travelInput = screen.getByText('Max History/User').parentElement!.querySelector('input')!;
      fireEvent.change(travelInput, { target: { value: '200' } });

      expect(onTravelChange).toHaveBeenCalled();
      expect(onEntityChange).not.toHaveBeenCalled();
    });
  });
});
