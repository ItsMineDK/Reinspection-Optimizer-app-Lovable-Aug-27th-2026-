/**
 * Civic (street) address resolution for stops.
 *
 * Tries the GeoNB civic address point layers first (nearest point within
 * 200 m), then falls back to OpenStreetMap reverse geocoding. Every lookup is
 * cached in IndexedDB so the addresses survive reloads and stay available
 * offline. Failures never throw — the stop simply keeps an empty address.
 */
import { STORE_CIVIC, idbGet, idbSet } from "./offline-db";

const CIVIC_LAYERS = [
  "https://geonb.snb.ca/arcgis/rest/services/GeoNB_SNB_CivicAddresses/MapServer/0",
  "https://geonb.snb.ca/arcgis/rest/services/GeoNB_SNB_CivicAddress/MapServer/0",
  "https://geonb.snb.ca/arcgis/rest/services/GeoNB_ENB_CivicAddresses/MapServer/0",
];

export const NOT_FOUND = "Not Found";

const key = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pick(attrs: Record<string, unknown>, needles: string[]) {
  for (const needle of needles) {
    const k = Object.keys(attrs).find((a) => a.toLowerCase().replace(/[^a-z]/g, "") === needle);
    if (k && attrs[k] != null && String(attrs[k]).trim() && String(attrs[k]) !== "null")
      return String(attrs[k]).trim();
  }
  for (const needle of needles) {
    const k = Object.keys(attrs).find((a) => a.toLowerCase().includes(needle));
    if (k && attrs[k] != null && String(attrs[k]).trim() && String(attrs[k]) !== "null")
      return String(attrs[k]).trim();
  }
  return "";
}

function addressFromAttributes(attrs: Record<string, unknown>) {
  const full = pick(attrs, ["fulladdress", "civicaddress", "address"]);
  if (full) return full;
  const num = pick(attrs, ["civicnumber", "civicnum", "number", "housenumber"]);
  const street = pick(attrs, ["streetname", "street", "roadname", "rdname"]);
  const town = pick(attrs, ["community", "municipality", "city", "town"]);
  const line = [num, street].filter(Boolean).join(" ");
  return [line, town].filter(Boolean).join(", ");
}

let workingLayer: string | null | undefined;

async function geoNbCivic(lat: number, lng: number): Promise<string> {
  const layers = workingLayer ? [workingLayer] : CIVIC_LAYERS;
  for (const layer of layers) {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      distance: "200",
      units: "esriSRUnit_Meter",
      outFields: "*",
      returnGeometry: "false",
      resultRecordCount: "1",
      where: "1=1",
      f: "json",
    });
    try {
      const res = await fetch(`${layer}/query?${params.toString()}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        error?: unknown;
        features?: { attributes?: Record<string, unknown> }[];
      };
      if (data.error) continue;
      workingLayer = layer;
      const attrs = data.features?.[0]?.attributes;
      if (!attrs) return "";
      return addressFromAttributes(attrs);
    } catch (err) {
      console.error("GeoNB civic address lookup failed", err);
    }
  }
  if (workingLayer === undefined) workingLayer = null;
  return "";
}

async function osmCivic(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return "";
    const data = (await res.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = data.address ?? {};
    const line = [a["house_number"], a["road"]].filter(Boolean).join(" ");
    const town = a["town"] ?? a["village"] ?? a["city"] ?? a["hamlet"] ?? a["county"] ?? "";
    const joined = [line, town].filter(Boolean).join(", ");
    return joined || (data.display_name ?? "").split(",").slice(0, 3).join(",").trim();
  } catch (err) {
    console.error("OSM reverse geocode failed", err);
    return "";
  }
}

/** Resolve one coordinate to a civic address, using the IndexedDB cache first. */
export async function resolveCivicAddress(lat: number, lng: number): Promise<string> {
  const k = key(lat, lng);
  const cached = await idbGet<string>(STORE_CIVIC, k);
  if (cached != null) return cached;
  let address = await geoNbCivic(lat, lng);
  if (!address) {
    address = await osmCivic(lat, lng);
    await sleep(1000); // Nominatim fair-use throttle
  }
  await idbSet(STORE_CIVIC, k, address);
  return address;
}

export type CivicPoint = { id: string; lat: number; lng: number };

/**
 * Resolve a batch of stops, rate limited to 5 requests/second. Never throws;
 * unresolved points are simply absent from the returned map.
 */
export async function resolveCivicAddresses(
  points: CivicPoint[],
  onProgress?: (done: number, total: number) => void,
  shouldStop?: () => boolean,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let done = 0;
  for (const p of points) {
    if (shouldStop?.()) break;
    const cached = await idbGet<string>(STORE_CIVIC, key(p.lat, p.lng));
    if (cached != null) {
      if (cached) out.set(p.id, cached);
    } else {
      const address = await resolveCivicAddress(p.lat, p.lng);
      if (address) out.set(p.id, address);
      await sleep(200); // max 5 requests per second
    }
    onProgress?.(++done, points.length);
  }
  return out;
}