/** GeoNB parcel lookup helpers (ArcGIS REST). */

export const PARCEL_LAYER_URL =
  "https://geonb.snb.ca/arcgis/rest/services/GeoNB_SNB_Parcels/FeatureServer/0";

/** GeoNB's parcel layer exposes the property identifier as PID (PAN in our CSV). */
export const PAN_FIELD = "PID";

export type PanMatch = { pan: string; lat: number; lng: number };

/** Parcel outline in [lat, lng] ring form. */
export type PanPolygon = { pan: string; rings: [number, number][][] };

type ArcGisFeature = {
  attributes?: Record<string, unknown>;
  geometry?: {
    rings?: [number, number][][];
    x?: number;
    y?: number;
  };
};

type GeoJsonFeature = {
  type: string;
  properties?: Record<string, unknown>;
  geometry?: GeoJSON.Geometry;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features?: GeoJsonFeature[];
};

function centroidOfRings(rings: [number, number][][]): [number, number] | null {
  const ring = rings[0];
  if (!ring?.length) return null;
  let x = 0;
  let y = 0;
  for (const [px, py] of ring) {
    x += px;
    y += py;
  }
  return [y / ring.length, x / ring.length];
}

/** Extract a [lat, lng] centroid from a GeoJSON geometry (Polygon or Point). */
function centroidOfGeoJson(geometry: GeoJSON.Geometry | undefined): [number, number] | null {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates as [number, number];
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    if (!ring?.length) return null;
    let x = 0;
    let y = 0;
    for (const [px, py] of ring) {
      x += px;
      y += py;
    }
    return [y / ring.length, x / ring.length];
  }
  if (geometry.type === "MultiPolygon") {
    const ring = geometry.coordinates[0]?.[0];
    if (!ring?.length) return null;
    let x = 0;
    let y = 0;
    for (const [px, py] of ring) {
      x += px;
      y += py;
    }
    return [y / ring.length, x / ring.length];
  }
  return null;
}

/** Extract [lat, lng] rings from a GeoJSON Polygon/MultiPolygon. */
function ringsFromGeoJson(geometry: GeoJSON.Geometry | undefined): [number, number][][] | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") return geometry.coordinates as [number, number][][];
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as [number, number][][][]).flat() as [number, number][][];
  }
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Look up parcel centroids by PAN. Never throws — unmatched PANs are returned. */
export async function lookupPans(
  pans: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ matched: Map<string, PanMatch>; unmatched: string[] }> {
  const clean = Array.from(new Set(pans.map((p) => p.trim()).filter(Boolean)));
  const matched = new Map<string, PanMatch>();
  const batches = chunk(clean, 60);
  let done = 0;

  for (const batch of batches) {
    const list = batch.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
    const params = new URLSearchParams({
      where: `${PAN_FIELD} IN (${list})`,
      outFields: PAN_FIELD,
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
    });
    try {
      const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json") || contentType.includes("geojson")) {
          const data = (await res.json()) as GeoJsonFeatureCollection;
          for (const f of data.features ?? []) {
            const pan = String(f.properties?.[PAN_FIELD] ?? f.properties?.["PAN"] ?? f.properties?.["pan"] ?? "").trim();
            if (!pan) continue;
            const point = centroidOfGeoJson(f.geometry);
            if (!point) continue;
            matched.set(pan, { pan, lat: point[0], lng: point[1] });
          }
        }
      }
    } catch (err) {
      console.error("GeoNB PAN lookup batch failed", err);
    }
    done += batch.length;
    onProgress?.(Math.min(done, clean.length), clean.length);
  }

  const unmatched = clean.filter((p) => !matched.has(p));
  return { matched, unmatched };
}

/** Resolve a single PAN (used by the manual fallback panel). */
export async function lookupSinglePan(pan: string): Promise<PanMatch | null> {
  const { matched } = await lookupPans([pan]);
  return matched.get(pan.trim()) ?? null;
}

/**
 * Fetch parcel outlines for a specific PAN list only. Surrounding, un-imported
 * parcels are never requested so the map only ever draws matched properties.
 */
export async function lookupPanPolygons(pans: string[]): Promise<Map<string, PanPolygon>> {
  const clean = Array.from(new Set(pans.map((p) => p.trim()).filter(Boolean)));
  const out = new Map<string, PanPolygon>();
  if (!clean.length) return out;

  for (const batch of chunk(clean, 60)) {
    const list = batch.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
    const params = new URLSearchParams({
      where: `${PAN_FIELD} IN (${list})`,
      outFields: PAN_FIELD,
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
    });
    try {
      const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
      if (!res.ok) continue;
      const data = (await res.json()) as GeoJsonFeatureCollection;
      for (const f of data.features ?? []) {
        const pan = String(f.properties?.[PAN_FIELD] ?? f.properties?.["PAN"] ?? f.properties?.["pan"] ?? "").trim();
        const rings = ringsFromGeoJson(f.geometry);
        if (!pan || !rings?.length) continue;
        out.set(pan, {
          pan,
          rings: rings.map((ring) => ring.map(([x, y]) => [y, x] as [number, number])),
        });
      }
    } catch (err) {
      console.error("GeoNB parcel outline batch failed", err);
    }
  }
  return out;
}

/**
 * Fetch every parcel outline intersecting a map viewport (no PAN filtering).
 * Used for the global GeoNB reference layer.
 */
export async function fetchParcelsInBounds(
  bbox: { west: number; south: number; east: number; north: number },
  maxRecords = 2000,
): Promise<Map<string, PanPolygon>> {
  const out = new Map<string, PanPolygon>();
  const params = new URLSearchParams({
    where: "1=1",
    geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: PAN_FIELD,
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(maxRecords),
    f: "geojson",
  });
  try {
    const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
    if (!res.ok) return out;
    const data = (await res.json()) as GeoJsonFeatureCollection;
    for (const f of data.features ?? []) {
      const pan = String(f.properties?.[PAN_FIELD] ?? f.properties?.["PAN"] ?? f.properties?.["pan"] ?? "").trim();
      const rings = ringsFromGeoJson(f.geometry);
      if (!rings?.length) continue;
      const key = pan || `${rings[0]?.[0]?.[0]},${rings[0]?.[0]?.[1]}`;
      out.set(key, {
        pan,
        rings: rings.map((ring) => ring.map(([x, y]) => [y, x] as [number, number])),
      });
    }
  } catch (err) {
    console.error("GeoNB viewport parcel fetch failed", err);
  }
  return out;
}
