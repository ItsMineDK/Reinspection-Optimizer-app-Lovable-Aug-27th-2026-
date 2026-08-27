import { i as __toESM } from "../_runtime.mjs";
import { b as require_react, y as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as require_leaflet_src } from "../_libs/leaflet.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PrintBooklet-1-t1Q6Ny.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_leaflet_src = /* @__PURE__ */ __toESM(require_leaflet_src());
function PrintMap({ stops, polyline, tall }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el || !stops.length) return;
		const map = import_leaflet_src.default.map(el, {
			zoomControl: false,
			attributionControl: false,
			dragging: false,
			scrollWheelZoom: false,
			keyboard: false
		});
		import_leaflet_src.default.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
		if (polyline.length > 1) import_leaflet_src.default.polyline(polyline, {
			color: "#4f46e5",
			weight: 3,
			opacity: .7
		}).addTo(map);
		stops.forEach((s) => {
			import_leaflet_src.default.marker([s.jLat, s.jLng], { icon: import_leaflet_src.default.divIcon({
				className: "seq-pin-wrapper",
				html: `<div class="seq-pin">${s.seq || "?"}</div>`,
				iconSize: [46, 22],
				iconAnchor: [23, 22]
			}) }).addTo(map);
		});
		map.fitBounds(import_leaflet_src.default.latLngBounds(stops.map((s) => [s.jLat, s.jLng])), { padding: [24, 24] });
		setTimeout(() => map.invalidateSize(), 100);
		return () => {
			map.remove();
		};
	}, [stops, polyline]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref,
		className: `print-map ${tall ? "print-map-tall" : ""}`
	});
}
function Manifest({ stops, columns = 1 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "print-manifest",
		style: { columnCount: columns },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "New SEQ" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "PAN" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Done" })
		] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: stops.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "mono",
				children: s.seq || "—"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "mono",
				children: s.pan || "—"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "checkbox",
				children: "[\xA0\xA0]"
			})
		] }, s.id)) })] })
	});
}
var MANIFEST_CHUNK = 120;
function PrintBooklet({ pages, mode, polyline, allStops, title }) {
	if (mode === "master") {
		const chunks = [];
		for (let i = 0; i < allStops.length; i += MANIFEST_CHUNK) chunks.push(allStops.slice(i, i + MANIFEST_CHUNK));
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "print-booklet",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "print-page",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [title, " — Master overview"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrintMap, {
					stops: allStops,
					polyline,
					tall: true
				})]
			}), chunks.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "print-page",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
					"Manifest ",
					i + 1,
					" / ",
					chunks.length
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Manifest, {
					stops: c,
					columns: 3
				})]
			}, i))]
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "print-booklet",
		children: pages.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "print-page",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
					title,
					" — ",
					p.title,
					" (",
					p.stops.length,
					" stops) · page ",
					i + 1,
					"/",
					pages.length
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrintMap, {
					stops: p.stops,
					polyline
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Manifest, {
					stops: p.stops,
					columns: p.stops.length > 30 ? 3 : 2
				})
			]
		}, i))
	});
}
//#endregion
export { PrintBooklet as default };
