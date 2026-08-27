import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-polylinedecorator";
import "leaflet-polylineoffset";
import type { MapConfig, OffRoadInfo, Stop, ZoneRoute } from "@/lib/route-utils";
import { zoneOf } from "@/lib/route-utils";
import { fetchParcelsInBounds, type PanPolygon } from "@/lib/geonb";
import { toast } from "sonner";

export type RouteMapHandle = {
  getMap: () => L.Map | null;
};

const STREET_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export type FocusTarget = { lat: number; lng: number; nonce: number };

type Props = {
  stops: Stop[];
  polyline: [number, number][];
  zoneRoutes?: ZoneRoute[];
  activeZone?: string | null;
  offRoad?: Map<string, OffRoadInfo>;
  showParcels: boolean;
  showPanLabels: boolean;
  showArrows?: boolean;
  activeLegOnly?: boolean;
  tracking: boolean;
  config: MapConfig;
  resizeSignal?: number;
  basemap?: "street" | "satellite";
  highlightPan?: string | null;
  focus?: FocusTarget | null;
  onViewChange: (center: [number, number], zoom: number) => void;
  handleRef?: Ref<RouteMapHandle>;
};

type DecoratorFactory = {
  polylineDecorator: (line: L.Polyline, opts: Record<string, unknown>) => L.Layer;
  Symbol: { arrowHead: (opts: Record<string, unknown>) => unknown };
};

export default function RouteMap({
  stops,
  polyline,
  zoneRoutes,
  activeZone,
  offRoad,
  showParcels,
  showPanLabels,
  showArrows = true,
  activeLegOnly = false,
  tracking,
  config,
  resizeSignal,
  basemap = "street",
  highlightPan,
  focus,
  onViewChange,
  handleRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.LayerGroup | null>(null);
  const accessRef = useRef<L.LayerGroup | null>(null);
  const parcelsRef = useRef<L.LayerGroup | null>(null);
  const parcelDataRef = useRef<Map<string, PanPolygon>>(new Map());
  const tileRef = useRef<L.TileLayer | null>(null);
  const highlightRef = useRef<string | null>(null);
  highlightRef.current = highlightPan ?? null;
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const gpsRef = useRef<L.Marker | null>(null);
  const viewCbRef = useRef(onViewChange);
  viewCbRef.current = onViewChange;
  const didFit = useRef(false);
  const panLabelsOn = useRef(showPanLabels);
  panLabelsOn.current = showPanLabels;
  const parcelsOn = useRef(showParcels);
  parcelsOn.current = showParcels;
  const zoomToastRef = useRef(0);

  useImperativeHandle(handleRef, () => ({ getMap: () => mapRef.current }), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: config.center,
      zoom: config.zoom,
      zoomControl: false,
      preferCanvas: false,
    });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    // Dedicated panes so parcels sit above tiles but below route markers/lines.
    map.createPane("parcelPane");
    const parcelPane = map.getPane("parcelPane");
    if (parcelPane) parcelPane.style.zIndex = "350";
    map.createPane("panLabelPane");
    const labelPane = map.getPane("panLabelPane");
    if (labelPane) {
      labelPane.style.zIndex = "360";
      labelPane.style.pointerEvents = "none";
    }
    tileRef.current = L.tileLayer(STREET_URL, {
      maxZoom: 19,
      crossOrigin: true,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    markersRef.current = L.layerGroup().addTo(map);
    parcelsRef.current = L.layerGroup();
    labelsRef.current = L.layerGroup();
    if (parcelsOn.current) parcelsRef.current.addTo(map);
    if (panLabelsOn.current) labelsRef.current.addTo(map);
    routeRef.current = L.layerGroup().addTo(map);
    accessRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on("moveend", () => {
      const c = map.getCenter();
      viewCbRef.current([c.lat, c.lng], map.getZoom());
    });
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    tileRef.current.setUrl(basemap === "satellite" ? SATELLITE_URL : STREET_URL);
    tileRef.current.options.attribution =
      basemap === "satellite"
        ? "Imagery &copy; Esri, Maxar, Earthstar Geographics"
        : "&copy; OpenStreetMap contributors";
  }, [basemap]);

  // Fly to a searched parcel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
  }, [focus]);

  /** Draw only the parcels present in the imported route list, zoom >= 13. */
  const renderParcels = () => {
    const map = mapRef.current;
    const group = parcelsRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!parcelsOn.current) return;
    const bounds = map.getBounds();
    for (const parcel of parcelDataRef.current.values()) {
      const highlighted = highlightRef.current === parcel.pan;
      const poly = L.polygon(parcel.rings, {
        color: highlighted ? "#f59e0b" : "#0f172a",
        weight: highlighted ? 4 : 2,
        opacity: highlighted ? 1 : 0.85,
        fillColor: "#6366f1",
        fillOpacity: highlighted ? 0.2 : 0.08,
        interactive: false,
        pane: "parcelPane",
      });
      if (!bounds.intersects(poly.getBounds())) continue;
      poly.addTo(group);
    }
    group.eachLayer((l) => (l as L.Polygon).bringToBack?.());
  };

  // Attach / detach the parcel + label layer groups when toggles flip
  useEffect(() => {
    const map = mapRef.current;
    const group = parcelsRef.current;
    if (!map || !group) return;
    if (showParcels) {
      if (!map.hasLayer(group)) group.addTo(map);
      renderParcels();
      map.invalidateSize();
    } else if (map.hasLayer(group)) {
      group.clearLayers();
      map.removeLayer(group);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showParcels]);

  useEffect(() => {
    const map = mapRef.current;
    const group = labelsRef.current;
    if (!map || !group) return;
    if (showPanLabels) {
      if (!map.hasLayer(group)) group.addTo(map);
      refreshLabels();
      map.invalidateSize();
    } else if (map.hasLayer(group)) {
      group.clearLayers();
      map.removeLayer(group);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPanLabels]);

  // Load ALL parcels in the current viewport (global GeoNB reference layer)
  const fetchSeq = useRef(0);
  const loadViewportParcels = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!parcelsOn.current && !panLabelsOn.current) {
      parcelDataRef.current = new Map();
      renderParcels();
      labelsRef.current?.clearLayers();
      return;
    }
    if (map.getZoom() < 13) {
      parcelDataRef.current = new Map();
      renderParcels();
      labelsRef.current?.clearLayers();
      const now = Date.now();
      if (now - zoomToastRef.current > 8000) {
        zoomToastRef.current = now;
        toast("Zoom in to load GeoNB parcels");
      }
      return;
    }
    const b = map.getBounds();
    const id = ++fetchSeq.current;
    void fetchParcelsInBounds({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    }).then((data) => {
      if (id !== fetchSeq.current) return;
      parcelDataRef.current = data;
      renderParcels();
      refreshLabels();
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadViewportParcels, 350);
    };
    loadViewportParcels();
    map.on("moveend zoomend", handler);
    return () => {
      if (timer) clearTimeout(timer);
      map.off("moveend zoomend", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showParcels, showPanLabels]);

  // Re-render on highlight change
  useEffect(() => {
    renderParcels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightPan]);

  // PAN labels inside parcel centroids (zoom >= 15)
  const refreshLabels = () => {
    const map = mapRef.current;
    const group = labelsRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!panLabelsOn.current) return;
    if (map.getZoom() < 13) {
      const now = Date.now();
      if (now - zoomToastRef.current > 8000) {
        zoomToastRef.current = now;
        toast("Zoom in to see PAN labels");
      }
      return;
    }
    const bounds = map.getBounds();
    for (const parcel of parcelDataRef.current.values()) {
      const pan = parcel.pan;
      const center = L.polygon(parcel.rings).getBounds().getCenter();
      if (!pan || !bounds.contains(center)) continue;
      L.marker(center, {
        interactive: false,
        pane: "panLabelPane",
        icon: L.divIcon({
          className: "pan-label-wrapper",
          html: `<div class="pan-label">${pan}</div>`,
          iconSize: [70, 16],
          iconAnchor: [35, 8],
        }),
      }).addTo(group);
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    refreshLabels();
    const handler = () => refreshLabels();
    map.on("moveend zoomend", handler);
    return () => {
      map.off("moveend zoomend", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPanLabels, showParcels]);

  // External resize trigger (sidebar collapse)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 260);
    return () => clearTimeout(t);
  }, [resizeSignal]);

  // Live GPS tracking
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onFound = (e: L.LocationEvent) => {
      if (!gpsRef.current) {
        gpsRef.current = L.marker(e.latlng, {
          icon: L.divIcon({
            className: "gps-dot-wrapper",
            html: '<div class="gps-dot"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        gpsRef.current.setLatLng(e.latlng);
      }
    };
    const onError = (e: L.ErrorEvent) => console.error("GPS error", e.message);

    if (tracking) {
      map.on("locationfound", onFound);
      map.on("locationerror", onError);
      map.locate({ setView: true, watch: true, enableHighAccuracy: true, maxZoom: 17 });
    }
    return () => {
      map.off("locationfound", onFound);
      map.off("locationerror", onError);
      map.stopLocate();
      if (gpsRef.current) {
        map.removeLayer(gpsRef.current);
        gpsRef.current = null;
      }
    };
  }, [tracking]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    const access = accessRef.current;
    if (!map || !group || !access) return;
    group.clearLayers();
    access.clearLayers();
    stops.forEach((s) => {
      const off = offRoad?.get(s.id);
      const inZone = !activeZone || zoneOf(s.seq) === activeZone;
      const icon = L.divIcon({
        className: `seq-pin-wrapper${inZone ? "" : " seq-muted"}`,
        html: `<div class="seq-pin${off ? " seq-pin-offroad" : ""}"><span class="seq-pin-order">${s.sequenceOrder}</span><span class="seq-pin-sep">·</span>${s.seq || "?"}${
          off ? " ↗" : ""
        }</div>`,
        iconSize: [62, 26],
        iconAnchor: [31, 26],
      });
      L.marker([s.jLat, s.jLng], { icon })
        .bindPopup(
          `<strong>Stop #${s.sequenceOrder} · SEQ ${s.seq}</strong><br/>PAN ${s.pan}${
            off ? `<br/><em>Set back ${Math.round(off.distance)} m from the road</em>` : ""
          }`,
        )
        .addTo(group);
      if (off && inZone) {
        L.polyline([off.snapped, [s.jLat, s.jLng]], {
          color: "#f59e0b",
          weight: 2,
          opacity: 0.9,
          dashArray: "5,6",
        }).addTo(access);
      }
    });
    if (stops.length && !didFit.current) {
      didFit.current = true;
      map.fitBounds(L.latLngBounds(stops.map((s) => [s.jLat, s.jLng] as [number, number])), {
        padding: [40, 40],
      });
    }
  }, [stops, offRoad, activeZone]);

  // Route polyline
  useEffect(() => {
    const map = mapRef.current;
    const group = routeRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const segments: ZoneRoute[] =
      zoneRoutes && zoneRoutes.length
        ? zoneRoutes
        : polyline.length > 1
          ? [{ zone: "#", polyline }]
          : [];

    for (const seg of segments) {
      if (seg.polyline.length < 2) continue;
      const active = !activeZone || seg.zone === activeZone;
      const line = L.polyline(seg.polyline, {
        color: active ? "#4f46e5" : "#94a3b8",
        weight: active ? 5 : 3,
        opacity: active ? 0.65 : 0.18,
        smoothFactor: 1,
        lineJoin: "round",
        // Offset perpendicular to travel direction so out-and-back passes
        // over the same road render on opposite lanes instead of overlapping.
        offset: 4,
      }).addTo(group);
      if (!active) continue;
      if (!showArrows) continue;
      if (activeLegOnly && (!activeZone || seg.zone !== activeZone)) continue;
      const deco = L as unknown as DecoratorFactory;
      if (typeof deco.polylineDecorator === "function") {
        try {
          deco
            .polylineDecorator(line, {
              patterns: [
                {
                  offset: 25,
                  repeat: "200px",
                  symbol: deco.Symbol.arrowHead({
                    pixelSize: 10,
                    polygon: false,
                    pathOptions: {
                      stroke: true,
                      color: "#1e1b4b",
                      weight: 3,
                      opacity: 0.9,
                      fillOpacity: 0.8,
                    },
                  }),
                },
              ],
            })
            .addTo(group);
        } catch (err) {
          console.error("Failed to render route arrows", err);
        }
      }
    }
  }, [polyline, zoneRoutes, activeZone, showArrows, activeLegOnly]);

  return (
    <div
      ref={containerRef}
      id="route-map"
      className="h-full w-full"
      style={{ touchAction: "none", overflow: "hidden" }}
    />
  );
}