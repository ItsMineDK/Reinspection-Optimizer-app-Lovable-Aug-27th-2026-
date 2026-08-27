/** GeoNB parcel lookup helpers (ArcGIS REST). */

export const PARCEL_LAYER_URL =
  "https://geonb.snb.ca/arcgis/rest/services/GeoNB_SNB_Parcels/MapServer/0";

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
      f: "json",
    });
    try {
      const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { features?: ArcGisFeature[] };
        for (const f of data.features ?? []) {
          const attrs = f.attributes ?? {};
          const pan = String(attrs[PAN_FIELD] ?? attrs["PAN"] ?? attrs["pan"] ?? "").trim();
          if (!pan) continue;
          let point: [number, number] | null = null;
          if (f.geometry?.rings) point = centroidOfRings(f.geometry.rings);
          else if (typeof f.geometry?.x === "number" && typeof f.geometry?.y === "number")
            point = [f.geometry.y, f.geometry.x];
          if (!point) continue;
          matched.set(pan, { pan, lat: point[0], lng: point[1] });
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
      f: "json",
    });
    try {
      const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { features?: ArcGisFeature[] };
      for (const f of data.features ?? []) {
        const pan = String(f.attributes?.[PAN_FIELD] ?? f.attributes?.["PAN"] ?? f.attributes?.["pan"] ?? "").trim();
        const rings = f.geometry?.rings;
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
    f: "json",
  });
  try {
    const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
    if (!res.ok) return out;
    const data = (await res.json()) as { features?: ArcGisFeature[] };
    for (const f of data.features ?? []) {
      const pan = String(f.attributes?.[PAN_FIELD] ?? f.attributes?.["PAN"] ?? f.attributes?.["pan"] ?? "").trim();
      const rings = f.geometry?.rings;
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
