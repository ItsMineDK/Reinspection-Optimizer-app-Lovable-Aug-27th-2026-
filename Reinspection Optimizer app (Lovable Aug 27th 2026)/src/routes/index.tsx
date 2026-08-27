import { createFileRoute } from "@tanstack/react-router";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  AlertTriangle,
  Loader2,
  ListOrdered,
  LocateFixed,
  MapPin,
  Navigation,
  PanelLeftClose,
  Menu,
  X,
  Printer,
  RefreshCw,
  Rocket,
  Route as RouteIcon,
  Search,
  Satellite,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FocusTarget, RouteMapHandle } from "@/components/RouteMap";
import { lookupPans, lookupSinglePan } from "@/lib/geonb";
import { buildPrintPages, type PrintMode, type PrintPage } from "@/lib/print-groups";
import {
  DEFAULT_MAP_CONFIG,
  buildLegs,
  detectColumns,
  detectOffRoad,
  directNavUrl,
  fetchRoute,
  formatDistance,
  formatDuration,
  googleMapsUrl,
  groupByZone,
  listZones,
  prepareStops,
  type DirectionLeg,
  type MapConfig,
  type Stop,
  type ZoneRoute,
} from "@/lib/route-utils";

const RouteMap = lazy(() => import("@/components/RouteMap"));
const PrintBooklet = lazy(() => import("@/components/PrintBooklet"));

const STORAGE_KEY = "route-optimizer-state-v1";

type Unmatched = { pan: string; seq: string };

type PersistedState = {
  stops: Stop[];
  polyline: [number, number][];
  zoneRoutes?: ZoneRoute[];
  config: MapConfig;
  fileName: string;
  directions?: DirectionLeg[];
  unmatched?: Unmatched[];
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Route Optimizer — NB Parcel Route Planner" },
      {
        name: "description",
        content:
          "Upload a CSV of property stops, auto-match GeoNB parcels, snap a driving route to real roads, filter zones and print a field booklet.",
      },
      { property: "og:title", content: "Route Optimizer — NB Parcel Route Planner" },
      {
        property: "og:description",
        content:
          "Plan, navigate and print sequenced property routes with GeoNB parcel overlays.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteOptimizerPage,
});

function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.stops)) return null;
    return {
      stops: parsed.stops,
      polyline: Array.isArray(parsed.polyline) ? parsed.polyline : [],
      zoneRoutes: Array.isArray(parsed.zoneRoutes) ? parsed.zoneRoutes : [],
      config: { ...DEFAULT_MAP_CONFIG, ...(parsed.config ?? {}) },
      fileName: parsed.fileName ?? "",
      directions: Array.isArray(parsed.directions) ? parsed.directions : [],
      unmatched: Array.isArray(parsed.unmatched) ? parsed.unmatched : [],
    };
  } catch (err) {
    console.error("Failed to rehydrate saved route", err);
    return null;
  }
}

function RouteOptimizerPage() {
  const [hydrated, setHydrated] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [polyline, setPolyline] = useState<[number, number][]>([]);
  const [zoneRoutes, setZoneRoutes] = useState<ZoneRoute[]>([]);
  const [directions, setDirections] = useState<DirectionLeg[]>([]);
  const [config, setConfig] = useState<MapConfig>(DEFAULT_MAP_CONFIG);
  const [fileName, setFileName] = useState("");
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [resolveInputs, setResolveInputs] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openLegs, setOpenLegs] = useState<string[]>([]);
  const [resizeSignal, setResizeSignal] = useState(0);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [showArrows, setShowArrows] = useState(true);
  const [activeLegOnly, setActiveLegOnly] = useState(false);
  const [basemap, setBasemap] = useState<"street" | "satellite">("street");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightPan, setHighlightPan] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);

  // Upload options
  const [uploadOpen, setUploadOpen] = useState(false);
  const [coordSource, setCoordSource] = useState<"csv" | "geonb">("csv");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Printing
  const [printOpen, setPrintOpen] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>("compact");
  const [printPages, setPrintPages] = useState<PrintPage[] | null>(null);
  const [preparingPrint, setPreparingPrint] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mapHandle = useRef<RouteMapHandle | null>(null);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setStops(saved.stops);
      setPolyline(saved.polyline);
      setZoneRoutes(saved.zoneRoutes ?? []);
      setDirections(saved.directions ?? []);
      setConfig(saved.config);
      setFileName(saved.fileName);
      setUnmatched(saved.unmatched ?? []);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          stops,
          polyline,
          zoneRoutes,
          config,
          fileName,
          directions,
          unmatched,
        } satisfies PersistedState),
      );
    } catch (err) {
      console.error("Failed to persist route state", err);
    }
  }, [hydrated, stops, polyline, zoneRoutes, config, fileName, directions, unmatched]);

  const zones = useMemo(() => listZones(stops), [stops]);
  const visibleStops = useMemo(
    () => (activeZone ? stops.filter((s) => s.seq.toUpperCase().startsWith(activeZone)) : stops),
    [stops, activeZone],
  );
  const legs = useMemo(() => buildLegs(visibleStops, 10), [visibleStops]);
  const legsRef = useRef<Stop[][]>([]);
  legsRef.current = legs;
  const offRoad = useMemo(() => detectOffRoad(stops, polyline, 30), [stops, polyline]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return visibleStops
      .filter((s) => s.pan.toLowerCase().includes(q) || s.seq.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, visibleStops]);

  const focusStop = useCallback((stop: Stop) => {
    setHighlightPan(stop.pan || null);
    setExpandedId(stop.id);
    setFocus({ lat: stop.jLat, lng: stop.jLng, nonce: Date.now() });
    setSearchOpen(false);
    setQuery(`${stop.seq} · ${stop.pan}`);
    setOpenLegs((open) => {
      const idx = legsRef.current.findIndex((leg) => leg.some((s) => s.id === stop.id));
      const key = `leg-${idx}`;
      return idx < 0 || open.includes(key) ? open : [...open, key];
    });
    setTimeout(() => {
      document.getElementById(`stop-${stop.id}`)?.scrollIntoView({ block: "center" });
    }, 120);
  }, []);

  const buildRoute = useCallback(async (list: Stop[]) => {
    if (list.length < 2) {
      setPolyline([]);
      setZoneRoutes([]);
      setDirections([]);
      return;
    }
    setRouting(true);
    try {
      const byZone = groupByZone(list);
      const routes: ZoneRoute[] = [];
      const allLegs: DirectionLeg[] = [];
      const all: [number, number][] = [];
      for (const [zone, zoneStops] of byZone) {
        if (zoneStops.length < 2) continue;
        const result = await fetchRoute(zoneStops);
        routes.push({ zone, polyline: result.polyline });
        allLegs.push(...result.legs);
        all.push(...result.polyline);
      }
      setZoneRoutes(routes);
      setPolyline(all);
      setDirections(allLegs);
      toast.success("Route snapped to roads");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't reach the routing service. Stops are still loaded.");
    } finally {
      setRouting(false);
    }
  }, []);

  const parseCsv = useCallback(
    async (file: File, mode: "csv" | "geonb") => {
      const text = await file.text();
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      const rows = result.data ?? [];
      const keys = Object.keys(rows[0] ?? {});
      const cols = detectColumns(keys);

      const raw = rows.map((row) => ({
        pan: cols.pan ? String(row[cols.pan] ?? "").trim() : "",
        seq: cols.seq ? String(row[cols.seq] ?? "").trim() : "",
        lat: cols.lat ? parseFloat(String(row[cols.lat] ?? "").trim()) : NaN,
        lng: cols.lng ? parseFloat(String(row[cols.lng] ?? "").trim()) : NaN,
      }));

      let parsed: Omit<Stop, "id" | "jLat" | "jLng">[] = [];
      let missing: Unmatched[] = [];

      if (mode === "csv") {
        if (!cols.lat || !cols.lng) {
          toast.error("No latitude/longitude columns found in that CSV.");
          return;
        }
        parsed = raw
          .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
          .map((r) => ({ pan: r.pan, seq: r.seq, lat: r.lat, lng: r.lng }));
      } else {
        if (!cols.pan) {
          toast.error("No PAN column found in that CSV.");
          return;
        }
        setMatching(true);
        try {
          const { matched } = await lookupPans(raw.map((r) => r.pan));
          for (const r of raw) {
            const hit = matched.get(r.pan);
            if (hit) parsed.push({ pan: r.pan, seq: r.seq, lat: hit.lat, lng: hit.lng });
            else if (Number.isFinite(r.lat) && Number.isFinite(r.lng))
              parsed.push({ pan: r.pan, seq: r.seq, lat: r.lat, lng: r.lng });
            else missing.push({ pan: r.pan, seq: r.seq });
          }
        } finally {
          setMatching(false);
        }
      }

      if (!parsed.length && !missing.length) {
        toast.error("No valid rows found in that CSV.");
        return;
      }

      const prepared = prepareStops(parsed);
      setStops(prepared);
      setPolyline([]);
      setZoneRoutes([]);
      setDirections([]);
      setUnmatched(missing);
      setActiveZone(null);
      setFileName(file.name);
      toast.success(
        `Loaded ${prepared.length} stops${missing.length ? ` · ${missing.length} unmatched` : ""}`,
      );
      void buildRoute(prepared);
    },
    [buildRoute],
  );

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    setPendingFile(file);
    setUploadOpen(true);
  }, []);

  const confirmUpload = async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    setUploadOpen(false);
    setPendingFile(null);
    try {
      await parseCsv(file, coordSource);
    } catch (err) {
      console.error("CSV parsing failed", err);
      toast.error("That CSV couldn't be parsed.");
    }
  };

  const resolveUnmatched = async (pan: string) => {
    const alt = (resolveInputs[pan] ?? "").trim();
    if (!alt) {
      toast.error("Enter a parent PAN or lat,lng first.");
      return;
    }
    setResolving(pan);
    try {
      let coords: [number, number] | null = null;
      const m = alt.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
      if (m) coords = [parseFloat(m[1]!), parseFloat(m[3]!)];
      else {
        const hit = await lookupSinglePan(alt);
        if (hit) coords = [hit.lat, hit.lng];
      }
      if (!coords) {
        toast.error(`No GeoNB parcel found for ${alt}`);
        return;
      }
      const entry = unmatched.find((u) => u.pan === pan);
      const next = prepareStops([
        ...stops.map((s) => ({ pan: s.pan, seq: s.seq, lat: s.lat, lng: s.lng })),
        { pan, seq: entry?.seq ?? "", lat: coords[0], lng: coords[1] },
      ]);
      setStops(next);
      setUnmatched((list) => list.filter((u) => u.pan !== pan));
      toast.success(`Resolved PAN ${pan}`);
      void buildRoute(next);
    } catch (err) {
      console.error("Manual PAN resolve failed", err);
      toast.error("Lookup failed. Try coordinates instead (lat,lng).");
    } finally {
      setResolving(null);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const stopEvent = (e: DragEvent<HTMLDivElement>, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearAll = () => {
    setStops([]);
    setPolyline([]);
    setZoneRoutes([]);
    setDirections([]);
    setUnmatched([]);
    setFileName("");
    setActiveZone(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open);
    setResizeSignal((n) => n + 1);
    const map = mapHandle.current?.getMap();
    setTimeout(() => map?.invalidateSize(), 60);
    setTimeout(() => map?.invalidateSize(), 320);
  };

  const mapVisible = stops.length > 0;

  // Whenever the map becomes visible again, force Leaflet to re-measure.
  useEffect(() => {
    if (!mapVisible) return;
    const map = mapHandle.current?.getMap();
    const t1 = setTimeout(() => mapHandle.current?.getMap()?.invalidateSize(), 80);
    const t2 = setTimeout(() => mapHandle.current?.getMap()?.invalidateSize(), 400);
    map?.invalidateSize();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapVisible, stops.length]);

  const startPrint = async () => {
    if (!stops.length) {
      toast.error("Load some stops first.");
      return;
    }
    setPrintOpen(false);
    setPreparingPrint(true);
    setPrintPages(buildPrintPages(visibleStops, printMode));
  };

  // Once the booklet has mounted and tiles have had time to load, print.
  useEffect(() => {
    if (!printPages) return;
    document.body.classList.add("printing-booklet");
    mapHandle.current?.getMap()?.invalidateSize();
    let inner: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      mapHandle.current?.getMap()?.invalidateSize();
      inner = setTimeout(() => {
        window.print();
        document.body.classList.remove("printing-booklet");
        setPrintPages(null);
        setPreparingPrint(false);
      }, 500);
    }, 2100);
    return () => {
      clearTimeout(t);
      clearTimeout(inner);
      document.body.classList.remove("printing-booklet");
    };
  }, [printPages]);

  const fitRoute = async () => {
    const map = mapHandle.current?.getMap();
    if (!map || !visibleStops.length) return;
    const L = (await import("leaflet")).default;
    map.fitBounds(
      L.latLngBounds(visibleStops.map((s) => [s.jLat, s.jLng] as [number, number])),
      { padding: [40, 40] },
    );
  };

  return (
    <div className="app-shell relative h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Minimal floating sidebar toggle — always reachable */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="no-print fixed left-3 top-3 z-[10000] rounded-lg bg-primary p-2.5 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      <div className="flex h-full min-h-0">
        <aside
          className={`no-print ${sidebarOpen ? "flex" : "hidden"} h-full min-h-0 w-full ${
            mapVisible ? "max-w-full sm:max-w-sm md:w-96" : "max-w-full"
          } shrink-0 flex-col overflow-hidden border-r border-border bg-card`}
        >
          {/* Sticky header */}
          <div className="shrink-0 space-y-3 border-b border-border bg-card p-4 pl-16">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <RouteIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold tracking-tight">
                    Route Optimizer
                  </h1>
                  <p className="truncate text-xs text-muted-foreground">
                    {stops.length
                      ? `${stops.length} stops · ${legs.length} legs`
                      : "No route loaded"}
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={toggleSidebar}>
                <PanelLeftClose className="size-4" /> Expand map
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="Search PAN or SEQ (e.g. A166, 12345678)"
                className="h-9 w-full pl-8 text-xs"
                aria-label="Search PAN or SEQ"
              />
              {searchOpen && suggestions.length > 0 && (
                <ul className="absolute left-0 top-11 z-[10001] w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => focusStop(s)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                      >
                        <Badge className="font-mono">{s.seq || "—"}</Badge>
                        <span className="truncate">PAN {s.pan || "—"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <Accordion type="multiple" defaultValue={["layers"]} className="px-4">
              <AccordionItem value="layers">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide">
                  Map View &amp; Layers
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="flex overflow-hidden rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => setBasemap("street")}
                      className={`flex-1 px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                        basemap === "street"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      Street Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setBasemap("satellite")}
                      className={`flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                        basemap === "satellite"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Satellite className="size-3" /> Satellite Aerial
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="parcels" className="text-xs">
                      GeoNB parcels
                    </Label>
                    <Switch
                      id="parcels"
                      checked={config.showParcels}
                      onCheckedChange={(v) => setConfig((c) => ({ ...c, showParcels: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="pan-labels" className="text-xs">
                      Show Parcel PANs
                    </Label>
                    <Switch
                      id="pan-labels"
                      checked={config.showPanLabels}
                      onCheckedChange={(v) => setConfig((c) => ({ ...c, showPanLabels: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={tracking ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setTracking((t) => !t)}
                  >
                    <LocateFixed className="size-4" />
                    {tracking ? "Stop GPS" : "Track My Location"}
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="zones">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide">
                  Zone &amp; Navigation Controls
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveZone(null)}
                      className={`rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors ${
                        activeZone === null
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      All Zones
                    </button>
                    {zones.map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setActiveZone(z)}
                        className={`rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors ${
                          activeZone === z
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        Zone {z}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="arrows" className="text-xs">
                      Show Route Arrows
                    </Label>
                    <Switch id="arrows" checked={showArrows} onCheckedChange={setShowArrows} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="active-leg" className="text-xs">
                      Active Leg Only
                    </Label>
                    <Switch
                      id="active-leg"
                      checked={activeLegOnly}
                      onCheckedChange={setActiveLegOnly}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="actions">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide">
                  Route Actions
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!stops.length}
                    onClick={() => void fitRoute()}
                  >
                    <RouteIcon className="size-4" /> Fit Route
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={preparingPrint}
                    onClick={() => setPrintOpen(true)}
                  >
                    {preparingPrint ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Printer className="size-4" />
                    )}
                    Print Route Field Booklet
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="import">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide">
                  Data Import
                </AccordionTrigger>
                <AccordionContent>
                  <form onSubmit={onSubmit} className="space-y-3">
                    <div
                      onDragEnter={(e) => stopEvent(e, true)}
                      onDragOver={(e) => stopEvent(e, true)}
                      onDragLeave={(e) => stopEvent(e, false)}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                        dragActive
                          ? "border-primary bg-accent"
                          : "border-border bg-muted/40 hover:border-primary/50"
                      }`}
                    >
                      {matching ? (
                        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="mx-auto size-5 text-muted-foreground" />
                      )}
                      <p className="mt-2 text-sm font-medium">
                        {matching ? "Matching PANs against GeoNB…" : "Drop a stops CSV"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fileName || "Latitude, Longitude, PAN, New SEQ"}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFile(file);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      />
                    </div>
                    {stops.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={routing}
                          onClick={() => void buildRoute(stops)}
                        >
                          {routing ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          Re-snap route
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                          <Trash2 className="size-4" /> Clear
                        </Button>
                      </div>
                    )}
                  </form>
                </AccordionContent>
              </AccordionItem>

              {unmatched.length > 0 && (
                <AccordionItem value="unmatched">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="size-4" /> Unmatched Properties ({unmatched.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {unmatched.map((u) => (
                      <div key={u.pan} className="rounded-lg border border-border bg-background p-3">
                        <p className="text-sm font-medium">PAN {u.pan || "—"}</p>
                        <p className="mb-2 text-xs text-muted-foreground">SEQ {u.seq || "—"}</p>
                        <div className="flex gap-2">
                          <Input
                            value={resolveInputs[u.pan] ?? ""}
                            onChange={(e) =>
                              setResolveInputs((m) => ({ ...m, [u.pan]: e.target.value }))
                            }
                            placeholder="Parent PAN or lat,lng"
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8"
                            disabled={resolving === u.pan}
                            onClick={() => void resolveUnmatched(u.pan)}
                          >
                            {resolving === u.pan ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Resolve"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {directions.length > 0 && (
                <AccordionItem value="directions">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide">
                    <span className="flex items-center gap-2">
                      <ListOrdered className="size-4" /> Written directions
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {directions.map((leg, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold">
                          {leg.fromSeq} → {leg.toSeq}
                        </p>
                        <p className="mb-2 text-xs text-muted-foreground">
                          {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
                        </p>
                        <ol className="space-y-1">
                          {leg.steps.map((step, j) => (
                            <li key={j} className="flex gap-2 text-xs">
                              <span className="font-mono text-muted-foreground">{j + 1}.</span>
                              <span>
                                {step.text}
                                {step.distance > 0 && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    ({formatDistance(step.distance)})
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Route legs — every leg collapsed by default */}
            <div className="p-4 pt-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Route legs{activeZone ? ` · Zone ${activeZone}` : ""}
              </p>
              <Accordion
                type="multiple"
                value={openLegs}
                onValueChange={setOpenLegs}
                className="space-y-2"
              >
                {legs.map((leg, i) => (
                  <AccordionItem
                    key={i}
                    value={`leg-${i}`}
                    className="rounded-lg border border-border px-3"
                  >
                    <AccordionTrigger className="text-sm">
                      <span className="truncate">
                        Leg {i + 1}: {leg[0]?.seq} → {leg[leg.length - 1]?.seq}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({leg.length} stops)
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <a
                        href={googleMapsUrl(leg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
                      >
                        <Rocket className="size-4 shrink-0" />
                        Launch Leg {i + 1} in Google Maps
                      </a>
                      <ul className="space-y-2">
                        {leg.map((s) => (
                          <li
                            key={s.id}
                            id={`stop-${s.id}`}
                            onClick={() => focusStop(s)}
                            className={`cursor-pointer rounded-lg border bg-background p-3 transition-colors ${
                              expandedId === s.id
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                className={`shrink-0 font-mono ${
                                  offRoad.has(s.id)
                                    ? "bg-amber-500 text-white hover:bg-amber-500"
                                    : ""
                                }`}
                              >
                                {s.seq || "—"}
                                {offRoad.has(s.id) ? " ↗" : ""}
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">PAN {s.pan || "—"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {offRoad.has(s.id)
                                    ? `Set back ${Math.round(offRoad.get(s.id)!.distance)} m from road`
                                    : `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
                                </p>
                              </div>
                              <a
                                href={directNavUrl(s)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Navigate to ${s.seq}`}
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-accent"
                              >
                                <MapPin className="size-4" />
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {!stops.length && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  <Navigation className="mx-auto mb-2 size-5" />
                  Upload a CSV to build your route.
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className={`map-shell relative min-w-0 flex-1 ${mapVisible ? "" : "hidden"}`}>
          {hydrated && mapVisible ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              }
            >
              <RouteMap
                handleRef={mapHandle}
                stops={stops}
                polyline={polyline}
                zoneRoutes={zoneRoutes}
                activeZone={activeZone}
                offRoad={offRoad}
                showParcels={config.showParcels}
                showPanLabels={config.showPanLabels}
                tracking={tracking}
                config={config}
                showArrows={showArrows}
                activeLegOnly={activeLegOnly}
                resizeSignal={resizeSignal}
                basemap={basemap}
                highlightPan={highlightPan}
                focus={focus}
                onViewChange={(center, zoom) =>
                  setConfig((c) =>
                    c.zoom === zoom && c.center[0] === center[0] && c.center[1] === center[1]
                      ? c
                      : { ...c, center, zoom },
                  )
                }
              />
            </Suspense>
          ) : (
            <div className="h-full bg-muted" />
          )}
        </main>
      </div>

      {/* CSV upload options */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="no-print">
          <DialogHeader>
            <DialogTitle>Import stops</DialogTitle>
            <DialogDescription>
              Choose where the coordinates for {pendingFile?.name ?? "this file"} come from.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={coordSource}
            onValueChange={(v) => setCoordSource(v as "csv" | "geonb")}
            className="gap-3"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="csv" id="src-csv" className="mt-1" />
              <span>
                <span className="block text-sm font-medium">Use coordinates from CSV</span>
                <span className="block text-xs text-muted-foreground">
                  Reads Latitude &amp; Longitude directly from the file.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="geonb" id="src-geonb" className="mt-1" />
              <span>
                <span className="block text-sm font-medium">
                  Auto-match coordinates via GeoNB layer
                </span>
                <span className="block text-xs text-muted-foreground">
                  Only needs PAN &amp; New SEQ. Unmatched PANs are listed for manual fixing.
                </span>
              </span>
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmUpload()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print density presets */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="no-print">
          <DialogHeader>
            <DialogTitle>🖨️ Print Route Field Booklet</DialogTitle>
            <DialogDescription>
              Pick a print density. {visibleStops.length} stops will be included
              {activeZone ? ` (Zone ${activeZone})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={printMode}
            onValueChange={(v) => setPrintMode(v as PrintMode)}
            className="gap-3"
          >
            {[
              {
                v: "compact",
                t: "Compact sector view",
                d: "~50–70 stops per page, grouped by 500 m spatial sectors.",
              },
              {
                v: "detailed",
                t: "Detailed block view",
                d: "~25 stops per page at high zoom.",
              },
              {
                v: "master",
                t: "Master map + manifest only",
                d: "One overview map, then multi-column check-sheets.",
              },
            ].map((o) => (
              <label
                key={o.v}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
              >
                <RadioGroupItem value={o.v} id={`pm-${o.v}`} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{o.t}</span>
                  <span className="block text-xs text-muted-foreground">{o.d}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPrintOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void startPrint()}>Build booklet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printPages && (
        <Suspense fallback={null}>
          <PrintBooklet
            pages={printPages}
            mode={printMode}
            polyline={polyline}
            allStops={visibleStops}
            title={fileName || "Route"}
          />
        </Suspense>
      )}
    </div>
  );
}
