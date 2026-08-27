import { useEffect, useRef } from "react";
import L from "leaflet";
import type { PrintMode, PrintPage } from "@/lib/print-groups";
import type { Stop } from "@/lib/route-utils";

type MapPageProps = {
  stops: Stop[];
  polyline: [number, number][];
  tall?: boolean;
};

function PrintMap({ stops, polyline, tall }: MapPageProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stops.length) return;
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      keyboard: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    if (polyline.length > 1) {
      L.polyline(polyline, { color: "#4f46e5", weight: 3, opacity: 0.7 }).addTo(map);
    }
    stops.forEach((s) => {
      L.marker([s.jLat, s.jLng], {
        icon: L.divIcon({
          className: "seq-pin-wrapper",
          html: `<div class="seq-pin"><span class="seq-pin-order">${s.sequenceOrder}</span><span class="seq-pin-sep">·</span>${s.seq || "?"}</div>`,
          iconSize: [62, 22],
          iconAnchor: [31, 22],
        }),
      }).addTo(map);
    });
    map.fitBounds(L.latLngBounds(stops.map((s) => [s.jLat, s.jLng] as [number, number])), {
      padding: [24, 24],
    });
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
    };
  }, [stops, polyline]);

  return <div ref={ref} className={`print-map ${tall ? "print-map-tall" : ""}`} />;
}

function Manifest({ stops, columns = 1 }: { stops: Stop[]; columns?: number }) {
  return (
    <div className="print-manifest" style={{ columnCount: columns }}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>New SEQ</th>
            <th>PAN</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.sequenceOrder}</td>
              <td className="mono">{s.seq || "—"}</td>
              <td className="mono">{s.pan || "—"}</td>
              <td className="checkbox">[&nbsp;&nbsp;]</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  pages: PrintPage[];
  mode: PrintMode;
  polyline: [number, number][];
  allStops: Stop[];
  title: string;
};

const MANIFEST_CHUNK = 120;

export default function PrintBooklet({ pages, mode, polyline, allStops, title }: Props) {
  if (mode === "master") {
    const chunks: Stop[][] = [];
    for (let i = 0; i < allStops.length; i += MANIFEST_CHUNK) {
      chunks.push(allStops.slice(i, i + MANIFEST_CHUNK));
    }
    return (
      <div className="print-booklet">
        <section className="print-page">
          <h2>{title} — Master overview</h2>
          <PrintMap stops={allStops} polyline={polyline} tall />
        </section>
        {chunks.map((c, i) => (
          <section className="print-page" key={i}>
            <h2>
              Manifest {i + 1} / {chunks.length}
            </h2>
            <Manifest stops={c} columns={3} />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="print-booklet">
      {pages.map((p, i) => (
        <section className="print-page" key={i}>
          <h2>
            {title} — {p.title} ({p.stops.length} stops) · page {i + 1}/{pages.length}
          </h2>
          <PrintMap stops={p.stops} polyline={polyline} />
          <Manifest stops={p.stops} columns={p.stops.length > 30 ? 3 : 2} />
        </section>
      ))}
    </div>
  );
}
