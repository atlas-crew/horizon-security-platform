/**
 * Design System — Component Showcase
 * ==================================
 *
 * Single-page reference documenting every component exported from `@/ui`.
 * Built using the design system itself, so any regression in <Panel>,
 * <Button>, <SectionHeader>, etc. will be immediately visible on this page.
 *
 * Routed at `/design-system` (registered in App.tsx). Not linked from the
 * sidebar by default — it's an internal reference doc rather than a
 * user-facing page.
 *
 * Structure: a single scrollable page with anchored sections. Each section
 * is wrapped in <Panel> and demonstrates one category of component. Use
 * Cmd+F to find a component by name.
 */

import { useState } from 'react';
import {
  Activity,
  Clock,
  Database,
  Download,
  ExternalLink,
  Info,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Zap,
} from 'lucide-react';

import { MetricCard as FleetMetricCard } from '../components/fleet';
import {
  // Layout primitives
  Box,
  Stack,
  Text,
  Grid,
  Divider,
  // Panels & section chrome
  Panel,
  SectionHeader,
  CARD_HEADER_TITLE_STYLE,
  PAGE_TITLE_STYLE,
  // Cards & metrics
  MetricCard,
  StatCard,
  KpiStrip,
  // Buttons
  Button,
  // Forms
  Input,
  Select,
  TimeRangeSelector,
  // Feedback / status
  Alert,
  StatusBadge,
  ProgressBar,
  Spinner,
  EmptyState,
  // Navigation
  Tabs,
  Breadcrumb,
  // Data display
  DataTable,
  ValuePill,
  // Overlays
  Modal,
  Drawer,
  Tooltip,
  // Tokens
  colors,
  chartColors,
  spacing,
} from '@/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────
//
// Showcase-only helpers. These are intentionally local: they're not part
// of the design system, just structural niceties for organizing the page.

interface ShowcaseSectionProps {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Section wrapper. Uses <Panel> so the showcase eats its own dog food —
 * if Panel breaks, the showcase visibly breaks too. Each section gets an
 * `id` for anchored navigation from the table of contents at the top.
 */
function ShowcaseSection({ id, title, description, children }: ShowcaseSectionProps) {
  return (
    <Panel tone="default" id={id} aria-labelledby={`${id}-heading`}>
      <Panel.Header>
        <SectionHeader
          titleId={`${id}-heading`}
          title={title}
          description={description}
          size="h4"
          style={{ marginBottom: 0 }}
          titleStyle={CARD_HEADER_TITLE_STYLE}
        />
      </Panel.Header>
      <Panel.Body className="space-y-6">{children}</Panel.Body>
    </Panel>
  );
}

/**
 * Caption row above an example. Lets the showcase label what each variant
 * is without reaching for <h4> / <h5> tags everywhere.
 */
function VariantLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted mb-2">
      {children}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

const TOC_SECTIONS: { id: string; label: string }[] = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'layout', label: 'Layout primitives' },
  { id: 'panels', label: 'Panel — tones & variants' },
  { id: 'metrics', label: 'Metrics & KPI cards' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'forms', label: 'Form controls' },
  { id: 'feedback', label: 'Feedback & status' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'data', label: 'Data display' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'utilities', label: 'Utilities' },
];

export default function DesignSystemPage() {
  // Overlay state — Modal, Drawer, and Tabs all need controlled state to
  // demo properly. Spinner / ProgressBar / Tooltip don't.
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('alpha');
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('option-2');

  return (
    <div className="p-6 space-y-6">
      {/* Page header — uses SectionHeader at h1 size to match the rest of the app */}
      <SectionHeader
        title="Design System"
        description="Live reference for every component exported from @/ui. Built with the design system itself."
        size="h1"
        style={{ marginBottom: 0 }}
        titleStyle={PAGE_TITLE_STYLE}
      />

      {/* Table of contents — anchored links so this page doubles as a reference */}
      <Panel tone="info" padding="md">
        <SectionHeader
          title="Components"
          description="Click to jump to a section."
          size="h4"
          style={{ marginBottom: 16 }}
          titleStyle={CARD_HEADER_TITLE_STYLE}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
          {TOC_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="text-ac-blue hover:text-ac-blue-bright hover:underline transition-colors"
            >
              {section.label}
            </a>
          ))}
        </div>
      </Panel>

      {/* ─── Foundations ───────────────────────────────────────────── */}
      <ShowcaseSection
        id="foundations"
        title="Foundations"
        description="Color tokens, chart palette, and typography. These are the raw materials every component is built from."
      >
        <div>
          <VariantLabel>Brand colors</VariantLabel>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {(
              [
                ['blue', colors.blue],
                ['navy', colors.navy],
                ['magenta', colors.magenta],
                ['green', colors.green],
                ['orange', colors.orange],
                ['red', colors.red],
              ] as const
            ).map(([name, value]) => (
              <div key={name}>
                <div className="h-12 border border-border-subtle" style={{ background: value }} />
                <div className="text-xs text-ink-secondary mt-1 font-mono">{name}</div>
                <div className="text-[10px] text-ink-muted font-mono">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <VariantLabel>Chart palette</VariantLabel>
          <div className="flex flex-wrap gap-2">
            {chartColors.slice(0, 8).map((color, i) => (
              <div
                key={i}
                className="h-8 w-12 border border-border-subtle"
                style={{ background: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        <div>
          <VariantLabel>Typography variants</VariantLabel>
          <Stack direction="column" gap="sm">
            <Text variant="display">Display — variant="display"</Text>
            <Text variant="heading">Heading — variant="heading"</Text>
            <Text variant="subhead">Subhead — variant="subhead"</Text>
            <Text variant="body">Body — variant="body"</Text>
            <Text variant="label">Label — variant="label"</Text>
            <Text variant="tag">Tag — variant="tag"</Text>
            <Text variant="metric">42.5k</Text>
            <Text variant="body" muted>
              Muted body via muted prop
            </Text>
          </Stack>
        </div>

        <div>
          <VariantLabel>Spacing scale</VariantLabel>
          <div className="space-y-1">
            {(['xs', 'xsPlus', 'sm', 'smPlus', 'md', 'lg', 'xl', '2xl', '3xl'] as const).map(
              (key) => {
                // spacing values are unitless numbers from the token file —
                // append `px` for use as a CSS width.
                const value = spacing[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="text-xs text-ink-secondary font-mono w-16">{key}</div>
                    <div className="h-2 bg-ac-blue" style={{ width: `${value}px` }} />
                    <div className="text-[10px] text-ink-muted font-mono">{value}px</div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </ShowcaseSection>

      {/* ─── Layout primitives ─────────────────────────────────────── */}
      <ShowcaseSection
        id="layout"
        title="Layout primitives"
        description="Box, Stack, Grid, and Divider. The atoms of layout — use these instead of hand-rolled flex containers."
      >
        <div>
          <VariantLabel>Stack — horizontal with gap</VariantLabel>
          <Stack direction="row" align="center" gap="md" className="bg-surface-subtle p-4">
            <Box className="bg-ac-blue text-white px-3 py-2 text-sm">Item 1</Box>
            <Box className="bg-ac-blue text-white px-3 py-2 text-sm">Item 2</Box>
            <Box className="bg-ac-blue text-white px-3 py-2 text-sm">Item 3</Box>
          </Stack>
        </div>

        <div>
          <VariantLabel>Stack — vertical with gap</VariantLabel>
          <Stack direction="column" gap="sm" className="bg-surface-subtle p-4">
            <Box className="bg-ac-blue text-white px-3 py-2 text-sm">First</Box>
            <Box className="bg-ac-blue text-white px-3 py-2 text-sm">Second</Box>
            <Box className="bg-ac-blue text-white px-3 py-2 text-sm">Third</Box>
          </Stack>
        </div>

        <div>
          <VariantLabel>Grid — 4 columns</VariantLabel>
          <Grid cols={4} gap="md">
            {[1, 2, 3, 4].map((n) => (
              <Box key={n} className="bg-ac-blue/10 border border-ac-blue/30 p-3 text-sm text-center">
                Cell {n}
              </Box>
            ))}
          </Grid>
        </div>

        <div>
          <VariantLabel>Divider</VariantLabel>
          <div>
            <p className="text-sm text-ink-primary">Above the divider</p>
            <Divider />
            <p className="text-sm text-ink-primary">Below the divider</p>
          </div>
        </div>
      </ShowcaseSection>

      {/* ─── Panel ─────────────────────────────────────────────────── */}
      <ShowcaseSection
        id="panels"
        title="Panel — tones & variants"
        description="The canonical card-shaped wrapper. tone controls the accent bar color; variant swaps the substrate (tactical, hero)."
      >
        <div>
          <VariantLabel>Tones (default variant)</VariantLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(
              [
                'default',
                'info',
                'success',
                'warning',
                'destructive',
                'advanced',
                'system',
              ] as const
            ).map((tone) => (
              <Panel key={tone} tone={tone} padding="md" spacing="none">
                <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                  tone="{tone}"
                </div>
                <div className="text-sm mt-2 text-ink-primary">
                  Sample content inside a {tone} panel.
                </div>
              </Panel>
            ))}
          </div>
        </div>

        <div>
          <VariantLabel>Compound slots — Panel.Header + Panel.Body</VariantLabel>
          <Panel tone="info">
            <Panel.Header>
              <SectionHeader
                title="Panel with slots"
                description="Header is a flex row with title + actions"
                size="h4"
                style={{ marginBottom: 0 }}
                titleStyle={CARD_HEADER_TITLE_STYLE}
              />
              <Button variant="outlined" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
                Action
              </Button>
            </Panel.Header>
            <Panel.Body>
              <p className="text-sm text-ink-primary">
                Body content goes here. The compound slot pattern auto-detects when{' '}
                <code>Panel.Header</code> / <code>Panel.Body</code> children are present and drops
                Panel's own padding so the slots can manage layout.
              </p>
            </Panel.Body>
          </Panel>
        </div>

        <div>
          <VariantLabel>Variant — tactical (scanlines + dot grid)</VariantLabel>
          <Panel tone="info" variant="tactical">
            <Panel.Header className="relative z-10">
              <SectionHeader
                title="Tactical variant"
                description="Used by the Live Attack Map on Threat Overview"
                size="h4"
                style={{ marginBottom: 0 }}
                titleStyle={CARD_HEADER_TITLE_STYLE}
              />
            </Panel.Header>
            <Panel.Body padding="md" className="relative z-10 h-32 flex items-center justify-center">
              <p className="text-sm text-ink-secondary">
                Children sit above the scanline overlay via <code>relative z-10</code>.
              </p>
            </Panel.Body>
          </Panel>
        </div>

        <div>
          <VariantLabel>Variant — hero (dark navy substrate)</VariantLabel>
          <Panel
            variant="hero"
            padding="md"
            spacing="none"
            className="group flex flex-col justify-center min-h-[180px]"
          >
            <div className="absolute top-0 right-0 w-32 h-full bg-white/5 diagonal-split transition-transform group-hover:scale-110 duration-500" />
            <div className="relative z-10">
              <Stack direction="row" align="center" gap="sm" className="mb-2">
                <Shield className="w-4 h-4 text-ac-sky" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ac-sky">
                  Hero variant
                </span>
              </Stack>
              <h3 className="text-xl font-light text-white mb-2">
                Marquee featured content
              </h3>
              <p className="text-sm text-white/70">
                Used for Strategic Insight on Threat Overview. Drops the accent bar entirely;
                navy substrate is the identity.
              </p>
            </div>
          </Panel>
        </div>
      </ShowcaseSection>

      {/* ─── Metrics ───────────────────────────────────────────────── */}
      <ShowcaseSection
        id="metrics"
        title="Metrics & KPI cards"
        description="MetricCard for fleet-style cards with descriptions, StatCard for analytics-style stat blocks, KpiStrip for compact rows."
      >
        <div>
          <VariantLabel>StatCard — with trend & icon</VariantLabel>
          <Grid cols={4} gap="md">
            <StatCard
              label="Total Requests"
              value="88.7k"
              trend={{ value: 12, label: 'vs previous' }}
              icon={<Activity className="w-6 h-6" />}
            />
            <StatCard
              label="Block Rate"
              value="1.65%"
              trend={{ value: -8, label: 'vs previous' }}
              icon={<Shield className="w-6 h-6" />}
            />
            <StatCard
              label="Avg Latency"
              value="42ms"
              icon={<Clock className="w-6 h-6" />}
              description="P95 across fleet"
            />
            <StatCard
              label="Active Sensors"
              value="12 / 12"
              trend={{ value: 0, label: 'unchanged' }}
              icon={<Database className="w-6 h-6" />}
            />
          </Grid>
        </div>

        <div>
          <VariantLabel>MetricCard — @/ui (subtitle + trend)</VariantLabel>
          <Grid cols={3} gap="md">
            <MetricCard
              label="CPU Usage"
              value="32%"
              subtitle="across all cores"
              trend="-2%"
              trendDirection="down"
            />
            <MetricCard
              label="Memory Usage"
              value="61%"
              subtitle="of total RAM"
              trend="+5%"
              trendDirection="up"
              borderColor={colors.orange}
            />
            <MetricCard
              label="Disk Usage"
              value="48%"
              subtitle="primary partition"
              borderColor={colors.green}
            />
          </Grid>
        </div>

        <div>
          <VariantLabel>FleetMetricCard — with tooltip description</VariantLabel>
          <Grid cols={3} gap="md">
            <FleetMetricCard
              label="Inbound Traffic"
              value="42.1 Mbps"
              description="Data received by this sensor from upstream clients"
              className="border-l-2 border-l-ac-blue"
            />
            <FleetMetricCard
              label="Active Connections"
              value="1,284"
              description="Currently open TCP connections being handled"
              className="border-l-2 border-l-ac-green"
            />
            <FleetMetricCard
              label="Packets/Sec"
              value="89,420"
              description="Network packets processed per second"
              className="border-l-2 border-l-ac-orange"
            />
          </Grid>
        </div>

        <div>
          <VariantLabel>KpiStrip — compact horizontal row</VariantLabel>
          <KpiStrip
            metrics={[
              { label: 'Requests', value: '12.4k', trend: '+8%', trendDirection: 'up' },
              { label: 'Blocked', value: '203', trend: '-3%', trendDirection: 'down' },
              { label: 'Allowed', value: '12.2k', trend: '+9%', trendDirection: 'up' },
              { label: 'Latency', value: '42ms', trend: '-2ms', trendDirection: 'down' },
              { label: 'Errors', value: '7', trend: '-50%', trendDirection: 'down' },
            ]}
            cols={5}
            size="default"
          />
        </div>
      </ShowcaseSection>

      {/* ─── Buttons ───────────────────────────────────────────────── */}
      <ShowcaseSection
        id="buttons"
        title="Buttons"
        description="Variants, sizes, and states. Primary is filled magenta; outlined is the ghost-secondary; ghost is text-only."
      >
        <div>
          <VariantLabel>Variants</VariantLabel>
          <Stack direction="row" gap="md" align="center" className="flex-wrap">
            <Button variant="primary">Primary</Button>
            <Button variant="outlined">Outlined</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Stack>
        </div>

        <div>
          <VariantLabel>Sizes</VariantLabel>
          <Stack direction="row" gap="md" align="center">
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary" size="md">
              Medium
            </Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
          </Stack>
        </div>

        <div>
          <VariantLabel>With icons</VariantLabel>
          <Stack direction="row" gap="md" align="center" className="flex-wrap">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
              Add new
            </Button>
            <Button
              variant="outlined"
              iconAfter={<ExternalLink className="w-3.5 h-3.5" />}
            >
              Open external
            </Button>
            <Button variant="ghost" icon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </Stack>
        </div>
      </ShowcaseSection>

      {/* ─── Form controls ─────────────────────────────────────────── */}
      <ShowcaseSection
        id="forms"
        title="Form controls"
        description="Input, Select, and TimeRangeSelector. All accept the same size prop and emit native onChange events."
      >
        <Grid cols={2} gap="md">
          <div>
            <VariantLabel>Input</VariantLabel>
            <Input
              id="ds-input-demo"
              label="Sensor name"
              placeholder="synapse-waf-1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              size="sm"
            />
          </div>
          <div>
            <VariantLabel>Select</VariantLabel>
            <Select
              id="ds-select-demo"
              label="Region"
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
              size="sm"
              options={[
                { value: 'option-1', label: 'us-east-1' },
                { value: 'option-2', label: 'us-west-2' },
                { value: 'option-3', label: 'eu-central-1' },
              ]}
            />
          </div>
        </Grid>

        <div>
          <VariantLabel>TimeRangeSelector</VariantLabel>
          <TimeRangeSelector
            value={timeRange as never}
            onChange={(v) => setTimeRange(v)}
            presets={['1h', '6h', '24h', '7d', '30d']}
          />
        </div>
      </ShowcaseSection>

      {/* ─── Feedback ──────────────────────────────────────────────── */}
      <ShowcaseSection
        id="feedback"
        title="Feedback & status"
        description="Alerts, status badges, progress, spinners, and empty states."
      >
        <div>
          <VariantLabel>Alert variants</VariantLabel>
          <Stack direction="column" gap="sm">
            <Alert status="info">
              <strong>Info:</strong> A new sensor version is available.
            </Alert>
            <Alert status="success">
              <strong>Success:</strong> Configuration deployed to 12 sensors.
            </Alert>
            <Alert status="warning">
              <strong>Warning:</strong> Sensor tunnel latency exceeds 200ms.
            </Alert>
            <Alert status="error">
              <strong>Error:</strong> Failed to push WAF rules to 2 sensors.
            </Alert>
          </Stack>
        </div>

        <div>
          <VariantLabel>StatusBadge variants</VariantLabel>
          <Stack direction="row" gap="sm" align="center" className="flex-wrap">
            <StatusBadge status="success">Healthy</StatusBadge>
            <StatusBadge status="warning">Degraded</StatusBadge>
            <StatusBadge status="error">Offline</StatusBadge>
            <StatusBadge status="info">Provisioning</StatusBadge>
            <StatusBadge status="success" variant="subtle">
              Subtle
            </StatusBadge>
            <StatusBadge status="error" variant="subtle" size="sm">
              Small subtle
            </StatusBadge>
          </Stack>
        </div>

        <div>
          <VariantLabel>ProgressBar</VariantLabel>
          <Stack direction="column" gap="md">
            <ProgressBar value={25} label="25% complete" />
            <ProgressBar value={65} label="65% complete" />
            <ProgressBar value={92} label="92% complete" />
          </Stack>
        </div>

        <div>
          <VariantLabel>Spinner</VariantLabel>
          <Stack direction="row" gap="lg" align="center">
            <Spinner size={16} color={colors.blue} />
            <Spinner size={24} color={colors.blue} />
            <Spinner size={32} color={colors.magenta} />
          </Stack>
        </div>

        <div>
          <VariantLabel>EmptyState</VariantLabel>
          <Panel tone="default" padding="md">
            <EmptyState
              icon={<Search className="w-8 h-8" />}
              title="No results found"
              description="Try adjusting your filters or expanding the time range."
              action={
                <Button variant="outlined" size="sm">
                  Reset filters
                </Button>
              }
            />
          </Panel>
        </div>
      </ShowcaseSection>

      {/* ─── Navigation ────────────────────────────────────────────── */}
      <ShowcaseSection
        id="navigation"
        title="Navigation"
        description="Tabs and Breadcrumb. Tabs support both a tabbed-bar style and pills."
      >
        <div>
          <VariantLabel>Breadcrumb</VariantLabel>
          <Breadcrumb
            items={[
              { label: 'Fleet', to: '/fleet' },
              { label: 'Sensors', to: '/fleet/sensors' },
              { label: 'synapse-waf-1' },
            ]}
          />
        </div>

        <div>
          <VariantLabel>Tabs — default style</VariantLabel>
          <Tabs
            tabs={[
              { key: 'alpha', label: 'Overview' },
              { key: 'beta', label: 'Performance' },
              { key: 'gamma', label: 'Configuration' },
              { key: 'delta', label: 'Network' },
            ]}
            active={activeTab}
            onChange={setActiveTab}
            ariaLabel="Showcase tabs"
          />
          <div className="mt-4 p-4 bg-surface-subtle text-sm text-ink-secondary">
            Active tab: <code>{activeTab}</code>
          </div>
        </div>

        <div>
          <VariantLabel>Tabs — pills variant</VariantLabel>
          <Tabs
            tabs={[
              { key: 'graph', label: 'Graph' },
              { key: 'table', label: 'Table' },
              { key: 'json', label: 'JSON' },
            ]}
            active={activeTab === 'alpha' ? 'graph' : activeTab}
            onChange={setActiveTab}
            variant="pills"
            size="sm"
            ariaLabel="View mode"
          />
        </div>
      </ShowcaseSection>

      {/* ─── Data display ──────────────────────────────────────────── */}
      <ShowcaseSection
        id="data"
        title="Data display"
        description="DataTable with custom column renderers, and the ValuePill helper for inline severity tags."
      >
        <div>
          <VariantLabel>DataTable</VariantLabel>
          <DataTable
            card={false}
            columns={[
              { key: 'sensor', label: 'Sensor', width: '200px' },
              { key: 'rps', label: 'RPS', align: 'right' },
              { key: 'latency', label: 'P95', align: 'right' },
              {
                key: 'status',
                label: 'Status',
                render: (v) => (
                  <ValuePill
                    value={String(v).toUpperCase()}
                    color={v === 'healthy' ? 'green' : v === 'degraded' ? 'orange' : 'red'}
                  />
                ),
              },
            ]}
            data={[
              { sensor: 'us-east-1', rps: '12,400', latency: '17ms', status: 'healthy' },
              { sensor: 'us-west-2', rps: '8,210', latency: '42ms', status: 'degraded' },
              { sensor: 'eu-central-1', rps: '4,890', latency: '203ms', status: 'unhealthy' },
            ]}
          />
        </div>

        <div>
          <VariantLabel>ValuePill colors</VariantLabel>
          <Stack direction="row" gap="sm" align="center" className="flex-wrap">
            <ValuePill value="0.42%" color="green" />
            <ValuePill value="1.65%" color="blue" />
            <ValuePill value="2.91%" color="orange" />
            <ValuePill value="8.12%" color="red" />
          </Stack>
        </div>
      </ShowcaseSection>

      {/* ─── Overlays ──────────────────────────────────────────────── */}
      <ShowcaseSection
        id="overlays"
        title="Overlays"
        description="Modal, Drawer, and Tooltip. Click the buttons to open the interactive demos."
      >
        <div>
          <VariantLabel>Modal — interactive demo</VariantLabel>
          <Stack direction="row" gap="md">
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <Button variant="outlined" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
          </Stack>
        </div>

        <div>
          <VariantLabel>Tooltip</VariantLabel>
          <Stack direction="row" gap="md" align="center">
            <Tooltip content="Tooltip on top">
              <Button variant="outlined" size="sm" icon={<Info className="w-4 h-4" />}>
                Hover me
              </Button>
            </Tooltip>
            <Tooltip content="Useful for inline help text">
              <span className="text-sm text-ink-secondary border-b border-dotted border-ink-muted cursor-help">
                Inline help
              </span>
            </Tooltip>
          </Stack>
        </div>
      </ShowcaseSection>

      {/* ─── Utilities ─────────────────────────────────────────────── */}
      <ShowcaseSection
        id="utilities"
        title="Utilities"
        description="Small helpers exported from @/ui — formatters, color manipulation, and section title styles."
      >
        <div>
          <VariantLabel>Section header styles</VariantLabel>
          <Stack direction="column" gap="md">
            <SectionHeader
              title="PAGE_TITLE_STYLE — used for h1 page titles"
              size="h1"
              style={{ marginBottom: 0 }}
              titleStyle={PAGE_TITLE_STYLE}
            />
            <SectionHeader
              title="CARD_HEADER_TITLE_STYLE — used inside Panel.Header"
              size="h4"
              style={{ marginBottom: 0 }}
              titleStyle={CARD_HEADER_TITLE_STYLE}
            />
            <SectionHeader
              title="With icon and description"
              description="SectionHeader supports actions, icons, and descriptions"
              icon={<Zap className="w-5 h-5 text-ac-blue" />}
              size="h4"
              style={{ marginBottom: 0 }}
              titleStyle={CARD_HEADER_TITLE_STYLE}
              actions={
                <Button variant="ghost" size="sm">
                  Action
                </Button>
              }
            />
          </Stack>
        </div>
      </ShowcaseSection>

      {/* ─── Modal & Drawer demo instances ─────────────────────────── */}
      {/* Rendered at the page root so they overlay the entire viewport. */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Sample modal">
        <Stack direction="column" gap="md">
          <p className="text-sm text-ink-primary">
            Modal content can include any components from the design system. Use them for
            confirmations, short forms, or when the action is destructive enough to warrant
            blocking the rest of the page.
          </p>
          <Alert status="warning">
            <strong>Heads up:</strong> Destructive actions should always show a Modal with a{' '}
            <code>destructive</code>-tone confirmation Button.
          </Alert>
          <Stack direction="row" gap="sm" justify="flex-end">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          </Stack>
        </Stack>
      </Modal>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Sample drawer">
        <Stack direction="column" gap="md">
          <p className="text-sm text-ink-primary">
            Drawers are right-anchored by default. Use them when the user needs to keep the
            underlying page visible while inspecting something.
          </p>
          <Input
            id="drawer-search"
            label="Filter by name"
            placeholder="synapse-..."
            size="sm"
          />
          <Select
            id="drawer-status"
            label="Status"
            size="sm"
            options={[
              { value: 'healthy', label: 'Healthy' },
              { value: 'degraded', label: 'Degraded' },
              { value: 'offline', label: 'Offline' },
            ]}
          />
          <Button variant="primary" fill onClick={() => setDrawerOpen(false)}>
            Apply filters
          </Button>
        </Stack>
      </Drawer>
    </div>
  );
}
