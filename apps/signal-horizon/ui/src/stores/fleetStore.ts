import { create } from 'zustand';
import type { SensorStatus } from '../types/fleet';

interface FleetFilters {
  status?: SensorStatus;
  region?: string;
  searchQuery?: string;
}

interface FleetStore {
  selectedSensorIds: Set<string>;
  filters: FleetFilters;
  selectSensor: (id: string) => void;
  deselectSensor: (id: string) => void;
  toggleSensor: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setStatusFilter: (status?: SensorStatus) => void;
  setRegionFilter: (region?: string) => void;
  setSearchQuery: (query?: string) => void;
  clearFilters: () => void;
}

export const useFleetStore = create<FleetStore>((set) => ({
  selectedSensorIds: new Set(),
  filters: {},

  selectSensor: (id) =>
    set((state) => ({ selectedSensorIds: new Set(state.selectedSensorIds).add(id) })),

  deselectSensor: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedSensorIds);
      newSet.delete(id);
      return { selectedSensorIds: newSet };
    }),

  toggleSensor: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedSensorIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return { selectedSensorIds: newSet };
    }),

  selectAll: (ids) => set(() => ({ selectedSensorIds: new Set(ids) })),
  clearSelection: () => set(() => ({ selectedSensorIds: new Set() })),

  setStatusFilter: (status) =>
    set((state) => ({ filters: { ...state.filters, status } })),

  setRegionFilter: (region) =>
    set((state) => ({ filters: { ...state.filters, region } })),

  setSearchQuery: (searchQuery) =>
    set((state) => ({ filters: { ...state.filters, searchQuery } })),

  clearFilters: () => set(() => ({ filters: {} })),
}));
