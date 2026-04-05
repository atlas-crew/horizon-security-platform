/**
 * Supply Chain Simulator Page
 *
 * Interactive dependency graph visualization with infection simulation.
 * Uses Cytoscape.js for the graph and Apparatus SimulatorApi for the backend.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import cytoscape from 'cytoscape';
// @ts-expect-error - fcose has no type declarations
import fcose from 'cytoscape-fcose';
import {
  GitBranch,
  RotateCcw,
  Crosshair,
  AlertTriangle,
  Loader2,
  Zap,
  ChevronRight,
  Package,
  Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '../lib/api';
import { useApparatusStatus } from '../hooks/useApparatusStatus';
import { useDemoMode } from '../stores/demoModeStore';
import { Stack, SectionHeader, Button, PAGE_TITLE_STYLE, colors as uiColors } from '@/ui';

cytoscape.use(fcose);

// =============================================================================
// Types (mirror SimulatorApi)
// =============================================================================

interface DependencyNode {
  id: string;
  name: string;
  version: string;
  type: 'app' | 'lib' | 'dev';
  status: 'clean' | 'infected' | 'compromised';
  dependencies: string[];
  dependents: string[];
}

interface DependencyGraph {
  nodes: Record<string, DependencyNode>;
}

interface InfectionResult {
  status: string;
  node: DependencyNode;
  impact: number;
}

interface AttackLog {
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
}

// =============================================================================
// Demo Data
// =============================================================================

function generateDemoGraph(): DependencyGraph {
  const nodes: Record<string, DependencyNode> = {
    'my-api': { id: 'my-api', name: 'my-api', version: '2.1.0', type: 'app', status: 'clean', dependencies: ['express', 'auth-lib', 'db-client', 'logger'], dependents: [] },
    'express': { id: 'express', name: 'express', version: '4.19.2', type: 'lib', status: 'clean', dependencies: ['body-parser', 'cookie-parser', 'qs'], dependents: ['my-api'] },
    'auth-lib': { id: 'auth-lib', name: '@corp/auth-lib', version: '1.4.0', type: 'lib', status: 'clean', dependencies: ['jsonwebtoken', 'bcrypt'], dependents: ['my-api'] },
    'db-client': { id: 'db-client', name: 'db-client', version: '3.2.1', type: 'lib', status: 'clean', dependencies: ['pg', 'connection-pool'], dependents: ['my-api'] },
    'logger': { id: 'logger', name: 'pino', version: '9.6.0', type: 'lib', status: 'clean', dependencies: ['sonic-boom', 'fast-redact'], dependents: ['my-api'] },
    'body-parser': { id: 'body-parser', name: 'body-parser', version: '1.20.3', type: 'lib', status: 'clean', dependencies: ['raw-body'], dependents: ['express'] },
    'cookie-parser': { id: 'cookie-parser', name: 'cookie-parser', version: '1.4.7', type: 'lib', status: 'clean', dependencies: [], dependents: ['express'] },
    'qs': { id: 'qs', name: 'qs', version: '6.13.0', type: 'lib', status: 'clean', dependencies: [], dependents: ['express'] },
    'jsonwebtoken': { id: 'jsonwebtoken', name: 'jsonwebtoken', version: '9.0.2', type: 'lib', status: 'clean', dependencies: ['jws', 'ms'], dependents: ['auth-lib'] },
    'bcrypt': { id: 'bcrypt', name: 'bcrypt', version: '5.1.1', type: 'lib', status: 'clean', dependencies: ['node-addon-api'], dependents: ['auth-lib'] },
    'pg': { id: 'pg', name: 'pg', version: '8.13.0', type: 'lib', status: 'clean', dependencies: ['pg-protocol'], dependents: ['db-client'] },
    'connection-pool': { id: 'connection-pool', name: 'generic-pool', version: '3.9.0', type: 'lib', status: 'clean', dependencies: [], dependents: ['db-client'] },
    'sonic-boom': { id: 'sonic-boom', name: 'sonic-boom', version: '4.2.0', type: 'lib', status: 'clean', dependencies: [], dependents: ['logger'] },
    'fast-redact': { id: 'fast-redact', name: 'fast-redact', version: '3.5.0', type: 'lib', status: 'clean', dependencies: [], dependents: ['logger'] },
    'raw-body': { id: 'raw-body', name: 'raw-body', version: '3.0.0', type: 'lib', status: 'clean', dependencies: [], dependents: ['body-parser'] },
    'jws': { id: 'jws', name: 'jws', version: '4.0.0', type: 'lib', status: 'clean', dependencies: [], dependents: ['jsonwebtoken'] },
    'ms': { id: 'ms', name: 'ms', version: '2.1.3', type: 'lib', status: 'clean', dependencies: [], dependents: ['jsonwebtoken'] },
    'node-addon-api': { id: 'node-addon-api', name: 'node-addon-api', version: '8.3.0', type: 'dev', status: 'clean', dependencies: [], dependents: ['bcrypt'] },
    'pg-protocol': { id: 'pg-protocol', name: 'pg-protocol', version: '1.7.0', type: 'lib', status: 'clean', dependencies: [], dependents: ['pg'] },
  };
  return { nodes };
}

// =============================================================================
// Graph Colors
// =============================================================================

const NODE_COLORS: Record<string, { bg: string; border: string }> = {
  clean: { bg: uiColors.blue, border: '#7EC8FF' },
  infected: { bg: '#EF4444', border: '#FCA5A5' },
  compromised: { bg: '#F59E0B', border: '#FCD34D' },
};

const TYPE_SHAPES: Record<string, string> = {
  app: 'diamond',
  lib: 'ellipse',
  dev: 'rectangle',
};

// =============================================================================
// Component
// =============================================================================

export default function SupplyChainPage() {
  const { isEnabled: isDemo } = useDemoMode();
  const { status: apparatusStatus } = useApparatusStatus();
  const isConnected = isDemo || apparatusStatus.state === 'connected';

  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<DependencyNode | null>(null);
  const [attackLogs, setAttackLogs] = useState<AttackLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInfecting, setIsInfecting] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch graph
  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isDemo) {
        setGraph(generateDemoGraph());
      } else {
        const data = await apiFetch<DependencyGraph>('/apparatus/simulator/graph');
        setGraph(data);
      }
    } catch {
      setGraph(generateDemoGraph()); // Fallback to demo
    } finally {
      setIsLoading(false);
    }
  }, [isDemo]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // Render Cytoscape graph
  useEffect(() => {
    if (!graph || !containerRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [];

    // Nodes
    for (const node of Object.values(graph.nodes)) {
      const color = NODE_COLORS[node.status] ?? NODE_COLORS.clean;
      elements.push({
        data: {
          id: node.id,
          label: `${node.name}\n${node.version}`,
          nodeType: node.type,
          status: node.status,
          bgColor: color.bg,
          borderColor: color.border,
        },
      });
    }

    // Edges
    for (const node of Object.values(graph.nodes)) {
      for (const dep of node.dependencies) {
        if (graph.nodes[dep]) {
          elements.push({
            data: {
              id: `${node.id}->${dep}`,
              source: node.id,
              target: dep,
            },
          });
        }
      }
    }

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '10px',
            'font-family': 'Rubik, sans-serif',
            color: '#E8ECF4',
            'text-margin-y': 8,
            'background-color': 'data(bgColor)',
            'border-color': 'data(borderColor)',
            'border-width': 2,
            width: 36,
            height: 36,
            shape: (ele: cytoscape.NodeSingular) => TYPE_SHAPES[ele.data('nodeType')] ?? 'ellipse',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node[status = "infected"]',
          style: {
            'border-width': 4,
            width: 44,
            height: 44,
          },
        },
        {
          selector: 'node[status = "compromised"]',
          style: {
            'border-width': 3,
            width: 40,
            height: 40,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#2A3F5C',
            'target-arrow-color': '#2A3F5C',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            opacity: 0.6,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': uiColors.magenta,
            'border-width': 4,
            'overlay-opacity': 0,
          } as cytoscape.Css.Node,
        },
      ],
      layout: {
        name: 'fcose',
        animate: true,
        animationDuration: 500,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 120,
        nodeRepulsion: 8000,
        gravity: 0.25,
      } as cytoscape.LayoutOptions,
      minZoom: 0.3,
      maxZoom: 3,
    });

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      const node = graph.nodes[id];
      if (node) setSelectedNode(node);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedNode(null);
    });

    cyRef.current = cy;

    return () => { cy.destroy(); };
  }, [graph]);

  // Update node styles when graph changes (infection)
  const updateNodeStyle = useCallback((nodeId: string, status: string) => {
    if (!cyRef.current) return;
    const el = cyRef.current.getElementById(nodeId);
    if (el.length) {
      const color = NODE_COLORS[status] ?? NODE_COLORS.clean;
      el.data('status', status);
      el.data('bgColor', color.bg);
      el.data('borderColor', color.border);
    }
  }, []);

  // Infect a node
  const handleInfect = useCallback(async (nodeId: string) => {
    setIsInfecting(true);
    try {
      if (isDemo) {
        // Simulate infection in demo mode
        setGraph((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, nodes: { ...prev.nodes } };
          const node = { ...updated.nodes[nodeId], status: 'infected' as const };
          updated.nodes[nodeId] = node;
          // Propagate to dependents
          for (const depId of node.dependents) {
            if (updated.nodes[depId]) {
              updated.nodes[depId] = { ...updated.nodes[depId], status: 'compromised' as const };
            }
          }
          return updated;
        });
        setAttackLogs((prev) => [
          { timestamp: new Date().toISOString(), message: `Package ${nodeId} infected — malicious payload injected`, type: 'critical' },
          { timestamp: new Date().toISOString(), message: `Blast radius: ${graph?.nodes[nodeId]?.dependents.length ?? 0} direct dependents compromised`, type: 'warning' },
          ...prev,
        ]);
      } else {
        const result = await apiFetch<InfectionResult>('/apparatus/simulator/infect', {
          method: 'POST',
          body: JSON.stringify({ id: nodeId }),
        });
        updateNodeStyle(nodeId, result.node.status);
        setAttackLogs((prev) => [
          { timestamp: new Date().toISOString(), message: `Package ${nodeId} infected — impact score: ${result.impact}`, type: 'critical' },
          ...prev,
        ]);
        await fetchGraph(); // Refresh full graph
      }
    } catch {
      setAttackLogs((prev) => [
        { timestamp: new Date().toISOString(), message: `Failed to infect ${nodeId}`, type: 'warning' },
        ...prev,
      ]);
    } finally {
      setIsInfecting(false);
    }
  }, [isDemo, graph, fetchGraph, updateNodeStyle]);

  // Full supply chain attack
  const handleAttack = useCallback(async () => {
    setIsAttacking(true);
    try {
      if (isDemo) {
        setAttackLogs((prev) => [
          { timestamp: new Date().toISOString(), message: 'Supply chain attack initiated — targeting transitive dependencies', type: 'critical' },
          { timestamp: new Date().toISOString(), message: 'Compromised: jsonwebtoken@9.0.2 via poisoned jws dependency', type: 'critical' },
          { timestamp: new Date().toISOString(), message: 'Session tokens being exfiltrated through DNS tunneling', type: 'critical' },
          { timestamp: new Date().toISOString(), message: 'DLP scanner detected anomalous outbound DNS pattern', type: 'info' },
          { timestamp: new Date().toISOString(), message: 'WAF rule triggered: suspicious base64 in DNS query', type: 'info' },
          ...prev,
        ]);
        // Infect jws → jsonwebtoken → auth-lib chain
        setGraph((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, nodes: { ...prev.nodes } };
          for (const id of ['jws', 'jsonwebtoken', 'auth-lib']) {
            if (updated.nodes[id]) {
              updated.nodes[id] = { ...updated.nodes[id], status: id === 'jws' ? 'infected' as const : 'compromised' as const };
            }
          }
          return updated;
        });
      } else {
        const result = await apiFetch<{ logs: string[] }>('/apparatus/simulator/attack', { method: 'POST' });
        setAttackLogs((prev) => [
          ...result.logs.map((msg) => ({ timestamp: new Date().toISOString(), message: msg, type: 'critical' as const })),
          ...prev,
        ]);
        await fetchGraph();
      }
    } finally {
      setIsAttacking(false);
    }
  }, [isDemo, fetchGraph]);

  // Reset
  const handleReset = useCallback(async () => {
    setAttackLogs([]);
    setSelectedNode(null);
    if (isDemo) {
      setGraph(generateDemoGraph());
    } else {
      try {
        await apiFetch('/apparatus/simulator/reset', { method: 'POST' });
        await fetchGraph();
      } catch { /* continue */ }
    }
  }, [isDemo, fetchGraph]);

  // Stats
  const stats = graph ? {
    total: Object.keys(graph.nodes).length,
    clean: Object.values(graph.nodes).filter((n) => n.status === 'clean').length,
    infected: Object.values(graph.nodes).filter((n) => n.status === 'infected').length,
    compromised: Object.values(graph.nodes).filter((n) => n.status === 'compromised').length,
  } : null;

  const LOG_COLORS: Record<string, string> = {
    info: 'text-ac-cyan',
    warning: 'text-ac-orange',
    critical: 'text-ac-red',
  };

  return (
    <div className="p-6 space-y-6">
      <Stack direction="row" align="center" justify="space-between">
        <SectionHeader
          title="Supply Chain Simulator"
          icon={<GitBranch className="w-5 h-5 text-ac-magenta" />}
          size="h1"
          titleStyle={PAGE_TITLE_STYLE}
        />
        <Stack direction="row" align="center" gap="sm">
          <Button variant="magenta" disabled={!isConnected || isAttacking} onClick={handleAttack}>
            <Stack direction="row" align="center" gap="sm">
              {isAttacking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              <span>Launch Attack</span>
            </Stack>
          </Button>
          <Button variant="outlined" onClick={handleReset}>
            <Stack direction="row" align="center" gap="sm">
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </Stack>
          </Button>
        </Stack>
      </Stack>

      {!isConnected && (
        <div className="px-4 py-3 border border-ac-orange/30 bg-ac-orange/10 text-sm text-ac-orange">
          <Stack direction="row" align="center" gap="sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Apparatus is not connected. Using local simulation mode.</span>
          </Stack>
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-surface-card border border-border-subtle p-3">
            <p className="text-[10px] text-ink-muted uppercase tracking-wider">Total Packages</p>
            <p className="text-xl font-mono text-ink-primary">{stats.total}</p>
          </div>
          <div className="bg-surface-card border border-border-subtle p-3">
            <p className="text-[10px] text-ink-muted uppercase tracking-wider">Clean</p>
            <p className="text-xl font-mono text-ac-blue">{stats.clean}</p>
          </div>
          <div className="bg-surface-card border border-border-subtle p-3">
            <p className="text-[10px] text-ink-muted uppercase tracking-wider">Infected</p>
            <p className="text-xl font-mono text-ac-red">{stats.infected}</p>
          </div>
          <div className="bg-surface-card border border-border-subtle p-3">
            <p className="text-[10px] text-ink-muted uppercase tracking-wider">Compromised</p>
            <p className="text-xl font-mono text-ac-orange">{stats.compromised}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph */}
        <div className="lg:col-span-2">
          <section className="bg-surface-card border border-border-subtle">
            <div className="px-4 py-3 border-b border-border-subtle">
              <Stack direction="row" align="center" justify="space-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium">Dependency Graph</p>
                <Stack direction="row" align="center" gap="md" className="text-[10px] text-ink-muted">
                  <Stack direction="row" align="center" gap="sm"><span className="w-2 h-2 bg-ac-blue" />lib</Stack>
                  <Stack direction="row" align="center" gap="sm"><span className="w-2 h-2 bg-ac-blue" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />app</Stack>
                  <Stack direction="row" align="center" gap="sm"><span className="w-2 h-2 bg-ac-red" />infected</Stack>
                  <Stack direction="row" align="center" gap="sm"><span className="w-2 h-2 bg-ac-orange" />compromised</Stack>
                </Stack>
              </Stack>
            </div>
            {isLoading ? (
              <div className="h-96 flex items-center justify-center text-ink-muted">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div ref={containerRef} className="h-96" />
            )}
          </section>
        </div>

        {/* Right: Selected Node + Controls */}
        <div className="space-y-6">
          {/* Selected Node Detail */}
          <section className="bg-surface-card border border-border-subtle">
            <div className="px-4 py-3 border-b border-border-subtle">
              <Stack direction="row" align="center" gap="sm">
                <Package className="w-4 h-4 text-ink-muted" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium">
                  {selectedNode ? 'Package Detail' : 'Select a Node'}
                </p>
              </Stack>
            </div>
            <div className="p-4">
              {selectedNode ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold text-ink-primary">{selectedNode.name}</p>
                    <p className="text-xs font-mono text-ink-muted">{selectedNode.version}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={clsx(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border',
                      selectedNode.type === 'app' ? 'text-ac-magenta border-ac-magenta/30 bg-ac-magenta/10' :
                      selectedNode.type === 'dev' ? 'text-ink-muted border-border-subtle bg-surface-subtle' :
                      'text-ac-blue border-ac-blue/30 bg-ac-blue/10',
                    )}>
                      {selectedNode.type}
                    </span>
                    <span className={clsx(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border',
                      selectedNode.status === 'clean' ? 'text-ac-green border-ac-green/30 bg-ac-green/10' :
                      selectedNode.status === 'infected' ? 'text-ac-red border-ac-red/30 bg-ac-red/10' :
                      'text-ac-orange border-ac-orange/30 bg-ac-orange/10',
                    )}>
                      {selectedNode.status}
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted space-y-1">
                    <p>{selectedNode.dependencies.length} dependencies</p>
                    <p>{selectedNode.dependents.length} dependents</p>
                  </div>
                  {selectedNode.status === 'clean' && (
                    <Button
                      variant="magenta"
                      size="sm"
                      disabled={isInfecting || !isConnected}
                      onClick={() => handleInfect(selectedNode.id)}
                    >
                      <Stack direction="row" align="center" gap="sm">
                        {isInfecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
                        <span>Infect Package</span>
                      </Stack>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Click a node in the graph to inspect it and simulate infection.</p>
              )}
            </div>
          </section>

          {/* Legend */}
          <section className="bg-surface-card border border-border-subtle p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium mb-2">How It Works</p>
            <div className="space-y-2 text-xs text-ink-muted">
              <p><strong className="text-ink-secondary">Infect</strong> — inject malware into a single package</p>
              <p><strong className="text-ink-secondary">Launch Attack</strong> — automated supply chain compromise targeting transitive dependencies</p>
              <p><strong className="text-ink-secondary">Blast radius</strong> — compromised (amber) nodes inherit infection through the dependency tree</p>
            </div>
          </section>
        </div>
      </div>

      {/* Attack Log */}
      {attackLogs.length > 0 && (
        <section className="bg-surface-card border border-border-subtle">
          <div className="px-4 py-3 border-b border-border-subtle">
            <Stack direction="row" align="center" justify="space-between">
              <Stack direction="row" align="center" gap="sm">
                <Shield className="w-4 h-4 text-ink-muted" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium">
                  Attack Log ({attackLogs.length} events)
                </p>
              </Stack>
            </Stack>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle">
            {attackLogs.map((log, i) => (
              <div key={i} className="px-4 py-2 flex items-start gap-3">
                <ChevronRight className={clsx('w-3 h-3 mt-0.5 flex-shrink-0', LOG_COLORS[log.type])} />
                <p className={clsx('text-sm flex-1', LOG_COLORS[log.type])}>{log.message}</p>
                <span className="text-[10px] text-ink-muted font-mono flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
