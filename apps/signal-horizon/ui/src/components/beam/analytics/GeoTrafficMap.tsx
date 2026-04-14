import { useEffect, useState, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { scaleThreshold } from 'd3-scale';
import { feature } from 'topojson-client';
import {
  Panel,
  SectionHeader,
  Spinner,
  CARD_HEADER_TITLE_STYLE,
  colors,
} from '@/ui';

// ─── deck.gl log silencing ────────────────────────────────────────────
// deck.gl/luma.gl emit shader debug output to the console and to any
// <pre> element they create. Previously this file monkeypatched
// document.createElement to hide those, which leaked a MutationObserver
// onto every <pre> in the whole app. The modern API is to set the log
// level to 0 on the luma global at module load. One call, scoped to
// this module, nothing else in the app notices.
if (typeof window !== 'undefined') {
  const w = window as unknown as { luma?: { log?: { level: number } } };
  w.luma = w.luma || {};
  w.luma.log = { level: 0 };
}

const WORLD_ATLAS_URL = 'https://unpkg.com/world-atlas@2.0.2/countries-110m.json';

// Demo Traffic Data by Country (ISO 3166-1 numeric)
const COUNTRY_TRAFFIC: Record<string, number> = {
  '840': 150000, // USA
  '826': 45000,  // GBR
  '276': 32000,  // DEU
  '250': 28000,  // FRA
  '392': 21000,  // JPN
  '036': 18000,  // AUS
  '124': 15000,  // CAN
  '076': 12000,  // BRA
  '356': 9000,   // IND
  '643': 5000,   // RUS
};

// ─── Colour scale ─────────────────────────────────────────────────────
// Sequential monotonic ramp: dark navy (lowest) → vivid blue → cyan
// (highest). Reads as "more = brighter" without needing to consult
// the legend. The previous scale wrapped cyan → blue → navy → black →
// red, which was non-monotonic and unreadable without a hover tooltip.
//
// Red is intentionally NOT in this scale. Reserving `status-error` for
// anomaly annotations means we can later paint a single country red
// on top of the traffic ramp to flag an attack, without the "alert"
// and "high traffic" concepts collapsing into the same colour.
const SCALE_DOMAIN = [1000, 5000, 10000, 50000, 100000];
const SCALE_RANGE: [number, number, number][] = [
  [11, 79, 138],    // ac-navy — lowest traffic
  [10, 110, 216],   // ac-blue-shade
  [30, 144, 255],   // ac-blue (vivid)
  [106, 192, 255],  // ac-blue-tint
  [6, 182, 212],    // ac-sky — highest traffic
  [125, 211, 252],  // extra-high (sky-light)
];
// d3-scale is untyped here, so the scale returns `any` — we narrow
// the result at the call site (see getFillColor below).
const COLOR_SCALE = scaleThreshold().domain(SCALE_DOMAIN).range(SCALE_RANGE);

// Unfilled countries use a tone just barely above surface-card so
// landmasses read as present without shouting. Borders pick up
// border-subtle so the world graticule is quiet.
const UNFILLED_FILL: [number, number, number] = [18, 24, 40];
const BORDER_COLOR: [number, number, number] = [46, 58, 82];

const INITIAL_VIEW_STATE = {
  latitude: 20,
  longitude: 0,
  zoom: 0.8,
  pitch: 0,
  bearing: 0,
};

// Legend stops for the on-card gradient key. Built from SCALE_DOMAIN
// directly so it stays in sync if the scale is re-tuned.
const LEGEND_STOPS: { label: string; color: [number, number, number] }[] = [
  { label: '<1k', color: SCALE_RANGE[0] },
  { label: '1k', color: SCALE_RANGE[1] },
  { label: '5k', color: SCALE_RANGE[2] },
  { label: '10k', color: SCALE_RANGE[3] },
  { label: '50k', color: SCALE_RANGE[4] },
  { label: '100k+', color: SCALE_RANGE[5] },
];

function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function GeoTrafficMap() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [countries, setCountries] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(WORLD_ATLAS_URL)
      .then((resp) => resp.json())
      .then((worldData) => {
        const countriesGeoJson = feature(
          worldData,
          worldData.objects.countries,
        );
        setCountries(countriesGeoJson);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load map data:', err);
        setError('Failed to load map');
        setIsLoading(false);
      });
  }, []);

  const layers = useMemo(() => {
    if (!countries) return [];
    return [
      new GeoJsonLayer({
        id: 'geo-traffic',
        data: countries,
        stroked: true,
        filled: true,
        lineWidthMinPixels: 0.5,
        getLineColor: BORDER_COLOR,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getFillColor: (d: any) => {
          const traffic = COUNTRY_TRAFFIC[d.id] || 0;
          if (traffic === 0) return UNFILLED_FILL;
          return COLOR_SCALE(traffic) as [number, number, number];
        },
        pickable: true,
        onHover: (info) =>
          setHoverInfo(
            info.object ? { x: info.x, y: info.y, object: info.object } : null,
          ),
        updateTriggers: {
          getFillColor: [COUNTRY_TRAFFIC],
        },
      }),
    ];
  }, [countries]);

  if (error) {
    return (
      <Panel tone="default">
        <Panel.Header>
          <SectionHeader
            title="Global Traffic Distribution"
            description="Requests by origin country"
            size="h4"
            style={{ marginBottom: 0 }}
            titleStyle={CARD_HEADER_TITLE_STYLE}
          />
        </Panel.Header>
        <Panel.Body className="h-80 flex items-center justify-center">
          <p className="text-ink-secondary">{error}</p>
        </Panel.Body>
      </Panel>
    );
  }

  return (
    <Panel
      tone="default"
      aria-label="Geographic traffic map showing global request distribution by country"
    >
      <Panel.Header>
        <SectionHeader
          title="Global Traffic Distribution"
          description="Requests by origin country"
          size="h4"
          style={{ marginBottom: 0 }}
          titleStyle={CARD_HEADER_TITLE_STYLE}
        />
      </Panel.Header>
      <Panel.Body padding="none" className="h-80 relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Spinner size={32} color={colors.blue} />
          </div>
        ) : (
          <>
            <div
              className="deck-container w-full h-full"
              // fontSize/lineHeight/color transparent keeps deck.gl's
              // hidden canvas-sibling log text from leaking into the
              // layout. These are defensive but cheap.
              style={{
                fontSize: 0,
                lineHeight: 0,
                color: 'transparent',
                overflow: 'hidden',
              }}
            >
              <DeckGL
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={layers}
                style={{ background: 'transparent' }}
              />
            </div>

            {/* Legend — small static gradient key anchored bottom-left.
                Renders on top of the deck canvas so it stays visible
                while the user pans/zooms. `pointer-events-none` keeps
                it from blocking hover interaction with the map. */}
            <div
              className="absolute bottom-3 left-3 bg-surface-card/90 border border-border-subtle px-3 py-2 pointer-events-none"
              aria-hidden="true"
            >
              <div className="text-[9px] uppercase tracking-widest text-ink-muted mb-1.5">
                Requests / country
              </div>
              <div className="flex items-center gap-1">
                {LEGEND_STOPS.map((stop) => (
                  <div key={stop.label} className="flex flex-col items-center gap-0.5">
                    <div
                      className="w-6 h-2"
                      style={{ background: rgbCss(stop.color) }}
                    />
                    <div className="text-[9px] font-mono text-ink-secondary">
                      {stop.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {hoverInfo && (
          <div
            className="absolute z-50 px-3 py-2 bg-ac-navy text-white text-xs shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
            style={{ left: hoverInfo.x, top: hoverInfo.y - 10 }}
          >
            <div className="font-bold">{hoverInfo.object.properties.name}</div>
            <div>
              {COUNTRY_TRAFFIC[hoverInfo.object.id]?.toLocaleString() || 0} Requests
            </div>
          </div>
        )}
      </Panel.Body>
    </Panel>
  );
}
