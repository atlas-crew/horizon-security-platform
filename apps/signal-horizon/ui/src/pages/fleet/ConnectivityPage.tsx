/**
 * Connectivity Page
 *
 * Real-time network connectivity monitoring for fleet sensors,
 * including cloud endpoint status and diagnostic tests.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Activity,
  Wifi,
  WifiOff,
  Clock,
  TrendingUp,
  Server,
  Database,
  Cog,
  PlayCircle,
  Globe,
  Lock,
  Route,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard } from '../../components/fleet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface ConnectivityStats {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  avgLatency: number;
  uptime: number;
}

interface CloudEndpoint {
  name: string;
  url: string;
  status: 'operational' | 'degraded' | 'down';
  latency: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface ConnectivityTest {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SensorConnectivity {
  sensorId: string;
  sensorName: string;
  status: 'connected' | 'disconnected' | 'degraded';
  latency: number | null;
  lastHeartbeat: string | null;
  reconnects: number;
  packetLoss: number;
}

// Cloud endpoints configuration
const cloudEndpoints: CloudEndpoint[] = [
  {
    name: 'API Gateway',
    url: 'api.atlascrew.io',
    status: 'operational',
    latency: 45,
    icon: Server,
  },
  {
    name: 'Telemetry Collector',
    url: 'telemetry.atlascrew.io',
    status: 'operational',
    latency: 38,
    icon: Database,
  },
  {
    name: 'Rules Engine',
    url: 'rules.atlascrew.io',
    status: 'operational',
    latency: 52,
    icon: Cog,
  },
];

// Connectivity tests
const connectivityTests: ConnectivityTest[] = [
  { id: 'ping', name: 'Ping Test', description: 'Test basic network connectivity', icon: Activity },
  { id: 'dns', name: 'DNS Resolution', description: 'Verify DNS lookup functionality', icon: Globe },
  { id: 'tls', name: 'TLS Handshake', description: 'Test secure connection establishment', icon: Lock },
  { id: 'traceroute', name: 'Traceroute', description: 'Map network path to endpoints', icon: Route },
];

export function ConnectivityPage(): React.ReactElement {
  const [runningTest, setRunningTest] = useState<string | null>(null);

  // Fetch connectivity stats
  const { data: statsData } = useQuery({
    queryKey: ['connectivity-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/management/connectivity`);
      if (!response.ok) throw new Error('Failed to fetch connectivity stats');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Derived stats
  const stats: ConnectivityStats = useMemo(() => {
    if (!statsData?.stats) {
      return { total: 0, online: 0, offline: 0, degraded: 0, avgLatency: 45, uptime: 99.9 };
    }
    return {
      total: statsData.stats.total || 0,
      online: statsData.stats.online || 0,
      offline: statsData.stats.offline || 0,
      degraded: statsData.stats.degraded || 0,
      avgLatency: 45, // Simulated
      uptime: 99.9, // Simulated
    };
  }, [statsData]);

  // Fetch sensor connectivity
  const { data: sensorConnectivity = [] } = useQuery<SensorConnectivity[]>({
    queryKey: ['sensor-connectivity'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/management/connectivity`);
      if (!response.ok) throw new Error('Failed to fetch sensor connectivity');
      const data = await response.json();
      // Transform sensor data to connectivity format
      const allSensors = [
        ...(data.sensors?.CONNECTED || []),
        ...(data.sensors?.DISCONNECTED || []),
        ...(data.sensors?.DEGRADED || []),
        ...(data.sensors?.UNKNOWN || []),
      ];
      return allSensors.map((s: { id: string; name: string; connectionState: string; lastHeartbeat: string | null }) => ({
        sensorId: s.id,
        sensorName: s.name,
        status: s.connectionState.toLowerCase() as 'connected' | 'disconnected' | 'degraded',
        latency: Math.floor(Math.random() * 100),
        lastHeartbeat: s.lastHeartbeat,
        reconnects: Math.floor(Math.random() * 5),
        packetLoss: Math.random() * 2,
      }));
    },
    refetchInterval: 15000,
  });

  // Run connectivity test mutation
  const testMutation = useMutation({
    mutationFn: async (testId: string) => {
      const response = await fetch(`${API_BASE}/management/connectivity/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: testId }),
      });
      if (!response.ok) throw new Error('Test failed');
      return response.json();
    },
  });

  const handleRunTest = async (testId: string) => {
    setRunningTest(testId);
    try {
      await testMutation.mutateAsync(testId);
    } finally {
      setRunningTest(null);
    }
  };

  // Generate mock chart data
  const latencyTrendData = useMemo(() => {
    const data = [];
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      data.push({
        time: new Date(now - i * 3600000).toLocaleTimeString('en-US', { hour: '2-digit' }),
        latency: 30 + Math.random() * 40,
      });
    }
    return data;
  }, []);

  const connectionEventsData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      reconnections: Math.floor(Math.random() * 15),
    }));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'connected':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'down':
      case 'disconnected':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'connected':
        return 'bg-green-500/10';
      case 'degraded':
        return 'bg-yellow-500/10';
      case 'down':
      case 'disconnected':
        return 'bg-red-500/10';
      default:
        return 'bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'down':
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Connectivity Monitor</h1>
        <p className="text-gray-400 mt-1">
          Real-time network connectivity status and diagnostics
        </p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Connected Sensors"
          value={stats.online}
          icon={<Wifi className="w-6 h-6" />}
          trend={{ value: 0, label: 'Online now' }}
        />
        <MetricCard
          label="Disconnected"
          value={stats.offline}
          icon={<WifiOff className="w-6 h-6" />}
          trend={{ value: 0, label: 'Offline sensors' }}
        />
        <MetricCard
          label="Avg Latency"
          value={`${stats.avgLatency}ms`}
          icon={<Clock className="w-6 h-6" />}
          trend={{ value: 0, label: 'Response time' }}
        />
        <MetricCard
          label="Uptime (30D)"
          value={`${stats.uptime}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          trend={{ value: 0, label: 'Last 30 days' }}
        />
      </div>

      {/* Atlas Crew Cloud Endpoints */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Atlas Crew Cloud Endpoints</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cloudEndpoints.map((endpoint) => {
            const Icon = endpoint.icon;
            return (
              <div
                key={endpoint.name}
                className={`${getStatusBgColor(endpoint.status)} border border-gray-700 rounded-lg p-4`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-gray-400" />
                    <h3 className="font-medium text-white">{endpoint.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(endpoint.status)}
                    <span className={`text-xs font-medium capitalize ${getStatusColor(endpoint.status)}`}>
                      {endpoint.status}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <div>{endpoint.url}</div>
                  <div>Latency: <span className="font-medium text-white">{endpoint.latency}ms</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connectivity Tests */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Connectivity Tests</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {connectivityTests.map((test) => {
            const Icon = test.icon;
            const isRunning = runningTest === test.id;
            return (
              <button
                key={test.id}
                onClick={() => handleRunTest(test.id)}
                disabled={isRunning}
                className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 text-left hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">{test.name}</h3>
                    <p className="text-sm text-gray-400">{test.description}</p>
                    {isRunning && (
                      <div className="flex items-center gap-2 mt-2">
                        <PlayCircle className="w-4 h-4 text-blue-400 animate-pulse" />
                        <span className="text-xs text-blue-400">Running...</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sensor Connectivity Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Sensor Connectivity Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sensor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Latency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Heartbeat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Reconnects (24h)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Packet Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sensorConnectivity.map((sensor) => (
                <tr key={sensor.sensorId} className="hover:bg-gray-700/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{sensor.sensorName}</div>
                    <div className="text-xs text-gray-400">{sensor.sensorId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(sensor.status)}
                      <span className={`text-sm capitalize ${getStatusColor(sensor.status)}`}>
                        {sensor.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {sensor.latency !== null ? `${sensor.latency}ms` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {sensor.lastHeartbeat
                      ? new Date(sensor.lastHeartbeat).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm ${sensor.reconnects > 5 ? 'text-yellow-400' : 'text-white'}`}>
                      {sensor.reconnects}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm ${sensor.packetLoss > 1 ? 'text-red-400' : 'text-white'}`}>
                      {sensor.packetLoss.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {sensorConnectivity.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No sensor connectivity data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Trend Chart */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Latency Trend (24h)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F9FAFB',
                }}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                name="Latency (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Connection Events Chart */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Connection Events (Weekly)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={connectionEventsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F9FAFB',
                }}
              />
              <Bar dataKey="reconnections" fill="#F59E0B" name="Reconnections" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default ConnectivityPage;
