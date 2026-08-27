export type Stop = {
  id: string;
  pan: string;
  seq: string;
  lat: number;
  lng: number;
  jLat: number;
  jLng: number;
  /** 1-based position in the sorted sequence order. */
  sequenceOrder: number;
  /** Resolved civic street address, when known. */
  address?: string;
};

export type MapConfig = {
  showParcels: boolean;
  showPanLabels: boolean;
  center: [number, number];
  zoom: number;
};

export const DEFAULT_MAP_CONFIG: MapConfig = {
  showParcels: true,
  showPanLabels: false,
  center: [46.5653, -66.4619],
  zoom: 8,
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function pickKey(keys: string[], matchers: ((k: string, raw: string) => boolean)[]) {
  for (const m of matchers) {
    const found = keys.find((k) => m(norm(k), k));
    if (found) return found;
  }
  return undefined;
}

export function detectColumns(keys: string[]) {
  const lat = pickKey(keys, [
    (k) => k === "latitudey",
    (k) => k.includes("latitude"),
    (k) => k === "lat",
    (k) => k.includes("lat"),
    (k) => k.endsWith("y"),
  ]);
  const lng = pickKey(keys, [
    (k) => k === "longitudex",
    (k) => k.includes("longitude"),
    (k) => k === "lng" || k === "long" || k === "lon",
    (k) => k.includes("lng") || k.includes("long"),
    (k) => k.endsWith("x"),
  ]);
  const pan = pickKey(keys, [
    (k) => k === "pan",
    (k) => k === "pan0",
    (k) => k.includes("pan"),
  ]);
  const seq = pickKey(keys, [
    (k) => k === "newseq" || k === "newseq0",
    (k) => k.includes("newseq"),
    (k) => k === "seqnumber",
    (k) => k.includes("seq"),
  ]);
  return { lat, lng, pan, seq };
}

/** Alphanumeric natural sort on the New SEQ value. */
export function compareSeq(a: string, b: string) {
  const re = /(\d+|\D+)/g;
  const ax = String(a ?? "").match(re) ?? [];
  const bx = String(b ?? "").match(re) ?? [];
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    const av = ax[i];
    const bv = bx[i];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    const an = /^\d+$/.test(av);
    const bn = /^\d+$/.test(bv);
    if (an && bn) {
      const d = Number(av) - Number(bv);
      if (d !== 0) return d;
    } else {
      const d = av.localeCompare(bv, undefined, { sensitivity: "base" });
      if (d !== 0) return d;
    }
  }
  return 0;
}

const JITTER = 0.00015;

/** Sort by SEQ, then jitter markers that share exact duplicate coordinates. */
export function prepareStops(raw: Omit<Stop, "jLat" | "jLng" | "id" | "sequenceOrder">[]): Stop[] {
  const sorted = [...raw].sort((a, b) => compareSeq(a.seq, b.seq));
  const seen = new Map<string, number>();
  return sorted.map((s, i) => {
    const key = `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    let jLat = s.lat;
    let jLng = s.lng;
    if (n > 0) {
      const angle = (n * 2 * Math.PI) / 6;
      jLat = s.lat + Math.sin(angle) * JITTER * Math.ceil(n / 6);
      jLng = s.lng + Math.cos(angle) * JITTER * Math.ceil(n / 6);
    }
    return { ...s, id: `${s.pan}-${s.seq}-${i}`, sequenceOrder: i + 1, jLat, jLng };
  });
}

/** Chunk into chained legs of at most 10 stops (last stop repeats as next origin). */
export function buildLegs(stops: Stop[], size = 10): Stop[][] {
  if (stops.length <= 1) return stops.length ? [stops] : [];
  const legs: Stop[][] = [];
  let start = 0;
  while (start < stops.length - 1) {
    const leg = stops.slice(start, start + size);
    legs.push(leg);
    start += size - 1;
  }
  return legs;
}

export function googleMapsUrl(leg: Stop[]) {
  const c = (s: Stop) => `${s.lat},${s.lng}`;
  const first = leg[0]!;
  const last = leg[leg.length - 1]!;
  const origin = encodeURIComponent(c(first));
  const destination = encodeURIComponent(c(last));
  const waypoints = leg
    .slice(1, -1)
    .map((s) => encodeURIComponent(c(s)))
    .join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
    waypoints ? `&waypoints=${waypoints}` : ""
  }&travelmode=driving`;
}

export function directNavUrl(stop: Stop) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${stop.lat},${stop.lng}`,
  )}&travelmode=driving`;
}

export type DirectionStep = {
  text: string;
  distance: number;
};

export type DirectionLeg = {
  fromSeq: string;
  toSeq: string;
  distance: number;
  duration: number;
  steps: DirectionStep[];
};

export type RouteResult = {
  polyline: [number, number][];
  legs: DirectionLeg[];
  /** True when the geometry came from the offline straight-line fallback. */
  offline?: boolean;
};

type OsrmManeuver = {
  type?: string;
  modifier?: string;
};

type OsrmStep = {
  name?: string;
  distance?: number;
  maneuver?: OsrmManeuver;
};

export function formatDistance(m: number) {
  if (!Number.isFinite(m)) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatDuration(s: number) {
  if (!Number.isFinite(s)) return "";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

/** Human readable instruction from an OSRM step maneuver. */
export function describeStep(step: OsrmStep): string {
  const road = step.name?.trim();
  const onto = road ? ` onto ${road}` : "";
  const type = step.maneuver?.type ?? "";
  const mod = step.maneuver?.modifier ?? "";
  const dir = mod.replace("slight ", "slight ").replace("sharp ", "sharp ");
  switch (type) {
    case "depart":
      return road ? `Head out on ${road}` : "Start driving";
    case "arrive":
      return "Arrive at the stop";
    case "turn":
      return `Turn ${dir || "ahead"}${onto}`;
    case "new name":
      return `Continue${onto}`;
    case "merge":
      return `Merge ${dir}${onto}`.replace("  ", " ");
    case "on ramp":
      return `Take the ramp ${dir}${onto}`.replace("  ", " ");
    case "off ramp":
      return `Take the exit ${dir}${onto}`.replace("  ", " ");
    case "fork":
      return `Keep ${dir || "ahead"}${onto}`;
    case "roundabout":
    case "rotary":
      return `Enter the roundabout and exit${onto}`;
    case "end of road":
      return `At the end of the road, turn ${dir || "ahead"}${onto}`;
    case "continue":
      return `Continue ${dir}${onto}`.replace("  ", " ");
    default:
      return `Continue${onto}`;
  }
}

/** OSRM road-snapped geometry + turn-by-turn steps, in SEQ order. Chunked for URL limits. */
export async function fetchRoute(stops: Stop[]): Promise<RouteResult> {
  if (stops.length < 2) return { polyline: [], legs: [] };
  const out: [number, number][] = [];
  const legs: DirectionLeg[] = [];
  const CHUNK = 24;
  let offline = false;
  for (let i = 0; i < stops.length - 1; i += CHUNK - 1) {
    const part = stops.slice(i, i + CHUNK);
    if (part.length < 2) break;
    if (offline) {
      appendStraightLine(part, out, legs);
      continue;
    }
    const coords = part.map((s) => `${s.lng},${s.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?steps=true&geometries=geojson&overview=full`;
    let route: {
      geometry: { coordinates: [number, number][] };
      legs?: { distance?: number; duration?: number; steps?: OsrmStep[] }[];
    } | null = null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM request failed (${res.status})`);
      const data = (await res.json()) as {
        code: string;
        routes?: typeof route[];
      };
      if (data.code !== "Ok" || !data.routes?.length) throw new Error("OSRM returned no route");
      route = data.routes[0]!;
    } catch (err) {
      // Offline / unreachable routing server: fall back to straight-line
      // connectors so sequencing and navigation stay usable in the field.
      console.error("OSRM unavailable, using straight-line fallback", err);
      offline = true;
      appendStraightLine(part, out, legs);
      continue;
    }
    for (const [lng, lat] of route.geometry.coordinates) out.push([lat, lng]);
    (route.legs ?? []).forEach((leg, li) => {
      const from = part[li];
      const to = part[li + 1];
      if (!from || !to) return;
      legs.push({
        fromSeq: from.seq || String(i + li + 1),
        toSeq: to.seq || String(i + li + 2),
        distance: leg.distance ?? 0,
        duration: leg.duration ?? 0,
        steps: (leg.steps ?? []).map((s) => ({
          text: describeStep(s),
          distance: s.distance ?? 0,
        })),
      });
    });
  }
  return { polyline: out, legs, offline };
}

/** Straight Haversine connectors used when the routing server can't be reached. */
function appendStraightLine(part: Stop[], out: [number, number][], legs: DirectionLeg[]) {
  for (let i = 0; i < part.length - 1; i++) {
    const a = part[i]!;
    const b = part[i + 1]!;
    out.push([a.jLat, a.jLng], [b.jLat, b.jLng]);
    const distance = metresBetween([a.jLat, a.jLng], [b.jLat, b.jLng]);
    legs.push({
      fromSeq: a.seq,
      toSeq: b.seq,
      distance,
      duration: (distance / 1000 / 50) * 3600,
      steps: [{ text: `Offline: head direct to ${b.seq || "next stop"}`, distance }],
    });
  }
}

/** Back-compat helper. */
export async function fetchRouteGeometry(stops: Stop[]) {
  return (await fetchRoute(stops)).polyline;
}
/* ---------- Zones (sequence prefix) ---------- */

/** Leading alpha prefix of a New SEQ value, e.g. "A" from "A001". "#" when none. */
export function zoneOf(seq: string) {
  const m = String(seq ?? "").trim().match(/^([A-Za-z]+)/);
  return m ? m[1]!.toUpperCase() : "#";
}

export function listZones(stops: Stop[]) {
  return Array.from(new Set(stops.map((s) => zoneOf(s.seq)))).sort();
}

export function groupByZone(stops: Stop[]) {
  const map = new Map<string, Stop[]>();
  for (const s of stops) {
    const z = zoneOf(s.seq);
    const arr = map.get(z);
    if (arr) arr.push(s);
    else map.set(z, [s]);
  }
  return map;
}

export type ZoneRoute = { zone: string; polyline: [number, number][] };

/* ---------- Off-road / landlocked parcels ---------- */

const EARTH = 6371000;

export function metresBetween(a: [number, number], b: [number, number]) {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type OffRoadInfo = { id: string; snapped: [number, number]; distance: number };

/**
 * Flag stops whose marker sits further than `threshold` metres from the nearest
 * snapped road point on the route geometry (flag lots / parcels behind parcels).
 */
export function detectOffRoad(
  stops: Stop[],
  polyline: [number, number][],
  threshold = 30,
): Map<string, OffRoadInfo> {
  const out = new Map<string, OffRoadInfo>();
  if (polyline.length < 2) return out;
  for (const s of stops) {
    let best = Infinity;
    let bestPt: [number, number] = polyline[0]!;
    for (const p of polyline) {
      const d = metresBetween([s.jLat, s.jLng], p);
      if (d < best) {
        best = d;
        bestPt = p;
      }
    }
    if (best > threshold) out.set(s.id, { id: s.id, snapped: bestPt, distance: best });
  }
  return out;
}
