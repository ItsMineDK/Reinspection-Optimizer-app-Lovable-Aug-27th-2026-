/**
 * Offline-first Leaflet tile layer.
 *
 * Tiles are read from IndexedDB first, then the network (5 s timeout). When a
 * satellite tile is unavailable offline we fall back to the cached street tile
 * for the same coordinate rather than rendering a blank grid square.
 */
import L from "leaflet";
import { STORE_TILES, idbCount, idbClear, idbGet, idbSet } from "./offline-db";

export type BasemapKind = "street" | "satellite";

export const STREET_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const LABELS_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png";

export const TILE_TIMEOUT_MS = 5000;

const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const tileKey = (kind: string, z: number, x: number, y: number) => `${kind}/${z}/${x}/${y}`;

export function urlFor(kind: BasemapKind, z: number, x: number, y: number) {
  return kind === "satellite"
    ? SATELLITE_URL.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x))
    : STREET_URL.replace("{s}", "a")
        .replace("{z}", String(z))
        .replace("{x}", String(x))
        .replace("{y}", String(y));
}

async function fetchTile(url: string): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TILE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, mode: "cors" });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function cachedTileCount() {
  return idbCount(STORE_TILES);
}

export async function clearTileCache() {
  return idbClear(STORE_TILES);
}

type CachedOptions = L.TileLayerOptions & { kind: BasemapKind };

const CachedTileLayer = L.TileLayer.extend({
  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback) {
    const img = document.createElement("img");
    img.alt = "";
    img.setAttribute("role", "presentation");
    const kind = (this.options as CachedOptions).kind;
    const { x, y, z } = coords;

    const apply = (src: string) => {
      img.onload = () => done(undefined, img);
      img.onerror = () => {
        img.src = BLANK;
        done(undefined, img);
      };
      img.crossOrigin = src.startsWith("blob:") || src.startsWith("data:") ? null : "anonymous";
      img.src = src;
    };

    void (async () => {
      const key = tileKey(kind, z, x, y);
      const cached = await idbGet<Blob>(STORE_TILES, key);
      if (cached) {
        apply(URL.createObjectURL(cached));
        return;
      }
      const blob = await fetchTile(urlFor(kind, z, x, y));
      if (blob) {
        void idbSet(STORE_TILES, key, blob);
        apply(URL.createObjectURL(blob));
        return;
      }
      // Offline fallback: reuse the cached street tile under satellite view.
      if (kind === "satellite") {
        const street = await idbGet<Blob>(STORE_TILES, tileKey("street", z, x, y));
        if (street) {
          apply(URL.createObjectURL(street));
          return;
        }
      }
      apply(BLANK);
    })();

    return img;
  },
});

export function createCachedTileLayer(kind: BasemapKind) {
  const attribution =
    kind === "satellite"
      ? "Imagery &copy; Esri, Maxar, Earthstar Geographics"
      : "&copy; OpenStreetMap contributors";
  return new (CachedTileLayer as unknown as new (url: string, opts: CachedOptions) => L.TileLayer)(
    kind === "satellite" ? SATELLITE_URL : STREET_URL,
    { kind, maxZoom: 19, attribution },
  );
}

/* ---------- Region pre-caching ---------- */

function lngToX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}
function latToY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

export type Bbox = { west: number; south: number; east: number; north: number };

export function zoomRangeFor(kind: BasemapKind): [number, number] {
  // Satellite imagery is heavy — cap it to keep storage near ~150 MB.
  return kind === "satellite" ? [14, 17] : [13, 18];
}

export function countRegionTiles(bbox: Bbox, kind: BasemapKind) {
  const [minZ, maxZ] = zoomRangeFor(kind);
  let total = 0;
  for (let z = minZ; z <= maxZ; z++) {
    const x0 = lngToX(bbox.west, z);
    const x1 = lngToX(bbox.east, z);
    const y0 = latToY(bbox.north, z);
    const y1 = latToY(bbox.south, z);
    total += (Math.abs(x1 - x0) + 1) * (Math.abs(y1 - y0) + 1);
  }
  return total;
}

/**
 * Sequentially download every tile covering `bbox`, max 5 requests per second
 * so Esri / OSM never rate-limit us with 429s.
 */
export async function downloadRegion(
  bbox: Bbox,
  kind: BasemapKind,
  onProgress: (done: number, total: number) => void,
  shouldStop?: () => boolean,
) {
  const [minZ, maxZ] = zoomRangeFor(kind);
  const total = countRegionTiles(bbox, kind);
  let done = 0;
  let failed = 0;
  for (let z = minZ; z <= maxZ; z++) {
    const x0 = Math.min(lngToX(bbox.west, z), lngToX(bbox.east, z));
    const x1 = Math.max(lngToX(bbox.west, z), lngToX(bbox.east, z));
    const y0 = Math.min(latToY(bbox.north, z), latToY(bbox.south, z));
    const y1 = Math.max(latToY(bbox.north, z), latToY(bbox.south, z));
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (shouldStop?.()) return { done, total, failed };
        const key = tileKey(kind, z, x, y);
        const existing = await idbGet<Blob>(STORE_TILES, key);
        if (!existing) {
          const blob = await fetchTile(urlFor(kind, z, x, y));
          if (blob) await idbSet(STORE_TILES, key, blob);
          else failed++;
          await new Promise((r) => setTimeout(r, 100)); // ~5 req/s incl. latency
        }
        onProgress(++done, total);
      }
    }
  }
  return { done, total, failed };
}