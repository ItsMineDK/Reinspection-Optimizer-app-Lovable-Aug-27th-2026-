import type { Stop } from "./route-utils";

export type PrintMode = "compact" | "detailed" | "master";

export type PrintPage = {
  title: string;
  stops: Stop[];
};

const R = 6371000;

export function haversine(a: [number, number], b: [number, number]) {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Group contiguous sequential stops into spatial sectors: a stop joins the
 * current page while the page is under `max` stops and the stop sits within
 * `radius` metres of the running page centroid.
 */
export function groupBySector(stops: Stop[], max: number, radius: number): PrintPage[] {
  const pages: PrintPage[] = [];
  let current: Stop[] = [];
  let sumLat = 0;
  let sumLng = 0;

  const flush = () => {
    if (!current.length) return;
    pages.push({
      title: `Sector ${pages.length + 1} · ${current[0]!.seq || "?"} – ${
        current[current.length - 1]!.seq || "?"
      }`,
      stops: current,
    });
    current = [];
    sumLat = 0;
    sumLng = 0;
  };

  for (const s of stops) {
    if (current.length) {
      const centroid: [number, number] = [sumLat / current.length, sumLng / current.length];
      const far = haversine(centroid, [s.jLat, s.jLng]) > radius;
      if (far || current.length >= max) flush();
    }
    current.push(s);
    sumLat += s.jLat;
    sumLng += s.jLng;
  }
  flush();
  return pages;
}

export function buildPrintPages(stops: Stop[], mode: PrintMode): PrintPage[] {
  if (!stops.length) return [];
  if (mode === "master") return [{ title: "Master overview", stops }];
  if (mode === "detailed") return groupBySector(stops, 25, 400);
  return groupBySector(stops, 60, 500);
}
