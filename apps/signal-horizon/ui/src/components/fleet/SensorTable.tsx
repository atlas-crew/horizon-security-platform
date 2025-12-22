import { useState, useMemo, useCallback } from 'react';
import type { SensorSummary } from '../../types/fleet';
import { SensorStatusBadge } from './SensorStatusBadge';

interface SensorTableProps {
  sensors: SensorSummary[];
  onSensorClick?: (sensor: SensorSummary) => void;
}

type SortField = keyof SensorSummary | 'none';
type SortDirection = 'asc' | 'desc';

export function SensorTable({ sensors, onSensorClick }: SensorTableProps) {
  const [sortField, setSortField] = useState<SortField>('none');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const sortedSensors = useMemo(() => {
    if (sortField === 'none') return sensors;
    return [...sensors].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sensors, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'cpu', label: 'CPU' },
    { key: 'memory', label: 'Memory' },
    { key: 'rps', label: 'RPS' },
    { key: 'latencyMs', label: 'Latency' },
    { key: 'version', label: 'Version' },
    { key: 'region', label: 'Region' },
  ] as const;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center gap-2">
                  {col.label} <SortIcon field={col.key} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedSensors.map((sensor) => (
            <tr
              key={sensor.id}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onSensorClick?.(sensor)}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sensor.name}</td>
              <td className="px-6 py-4 whitespace-nowrap"><SensorStatusBadge status={sensor.status} /></td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.cpu.toFixed(1)}%</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.memory.toFixed(1)}%</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.rps.toLocaleString()}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sensor.latencyMs.toFixed(0)}ms</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sensor.version}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sensor.region}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sortedSensors.length === 0 && (
        <div className="text-center py-12 text-gray-500">No sensors found</div>
      )}
    </div>
  );
}
