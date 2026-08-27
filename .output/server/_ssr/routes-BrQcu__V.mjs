import { i as __toESM } from "../_runtime.mjs";
import { a as Trigger2, b as require_react, i as Root2, m as Slot, n as Header, r as Item, t as Content2, y as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as require_papaparse } from "../_libs/papaparse.mjs";
import { _ as ListOrdered, a as Search, c as Rocket, d as PanelLeftClose, f as Navigation, g as LoaderCircle, h as LocateFixed, i as Trash2, l as RefreshCw, m as MapPin, n as Upload, o as Satellite, p as Menu, r as TriangleAlert, s as Route, t as X, u as Printer, v as Circle, y as ChevronDown } from "../_libs/lucide-react.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as RadioGroupIndicator, r as RadioGroupItem$1, t as RadioGroup$1 } from "../_libs/@radix-ui/react-radio-group+[...].mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/radix-ui__react-switch.mjs";
import { t as Root } from "../_libs/radix-ui__react-label.mjs";
import { a as DialogOverlay$1, i as DialogDescription$1, n as DialogClose, o as DialogPortal$1, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { i as __exportAll } from "./server-u-sYRavH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BrQcu__V.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_papaparse = /* @__PURE__ */ __toESM(require_papaparse());
var DEFAULT_MAP_CONFIG = {
	showParcels: true,
	showPanLabels: false,
	center: [46.5653, -66.4619],
	zoom: 8
};
var norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function pickKey(keys, matchers) {
	for (const m of matchers) {
		const found = keys.find((k) => m(norm(k), k));
		if (found) return found;
	}
}
function detectColumns(keys) {
	return {
		lat: pickKey(keys, [
			(k) => k === "latitudey",
			(k) => k.includes("latitude"),
			(k) => k === "lat",
			(k) => k.includes("lat"),
			(k) => k.endsWith("y")
		]),
		lng: pickKey(keys, [
			(k) => k === "longitudex",
			(k) => k.includes("longitude"),
			(k) => k === "lng" || k === "long" || k === "lon",
			(k) => k.includes("lng") || k.includes("long"),
			(k) => k.endsWith("x")
		]),
		pan: pickKey(keys, [
			(k) => k === "pan",
			(k) => k === "pan0",
			(k) => k.includes("pan")
		]),
		seq: pickKey(keys, [
			(k) => k === "newseq" || k === "newseq0",
			(k) => k.includes("newseq"),
			(k) => k === "seqnumber",
			(k) => k.includes("seq")
		])
	};
}
/** Alphanumeric natural sort on the New SEQ value. */
function compareSeq(a, b) {
	const re = /(\d+|\D+)/g;
	const ax = String(a ?? "").match(re) ?? [];
	const bx = String(b ?? "").match(re) ?? [];
	for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
		const av = ax[i];
		const bv = bx[i];
		if (av === void 0) return -1;
		if (bv === void 0) return 1;
		const an = /^\d+$/.test(av);
		const bn = /^\d+$/.test(bv);
		if (an && bn) {
			const d = Number(av) - Number(bv);
			if (d !== 0) return d;
		} else {
			const d = av.localeCompare(bv, void 0, { sensitivity: "base" });
			if (d !== 0) return d;
		}
	}
	return 0;
}
var JITTER = 15e-5;
/** Sort by SEQ, then jitter markers that share exact duplicate coordinates. */
function prepareStops(raw) {
	const sorted = [...raw].sort((a, b) => compareSeq(a.seq, b.seq));
	const seen = /* @__PURE__ */ new Map();
	return sorted.map((s, i) => {
		const key = `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
		const n = seen.get(key) ?? 0;
		seen.set(key, n + 1);
		let jLat = s.lat;
		let jLng = s.lng;
		if (n > 0) {
			const angle = n * 2 * Math.PI / 6;
			jLat = s.lat + Math.sin(angle) * JITTER * Math.ceil(n / 6);
			jLng = s.lng + Math.cos(angle) * JITTER * Math.ceil(n / 6);
		}
		return {
			...s,
			id: `${s.pan}-${s.seq}-${i}`,
			jLat,
			jLng
		};
	});
}
/** Chunk into chained legs of at most 10 stops (last stop repeats as next origin). */
function buildLegs(stops, size = 10) {
	if (stops.length <= 1) return stops.length ? [stops] : [];
	const legs = [];
	let start = 0;
	while (start < stops.length - 1) {
		const leg = stops.slice(start, start + size);
		legs.push(leg);
		start += size - 1;
	}
	return legs;
}
function googleMapsUrl(leg) {
	const c = (s) => `${s.lat},${s.lng}`;
	const first = leg[0];
	const last = leg[leg.length - 1];
	const origin = encodeURIComponent(c(first));
	const destination = encodeURIComponent(c(last));
	const waypoints = leg.slice(1, -1).map((s) => encodeURIComponent(c(s))).join("|");
	return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;
}
function directNavUrl(stop) {
	return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.lat},${stop.lng}`)}&travelmode=driving`;
}
function formatDistance(m) {
	if (!Number.isFinite(m)) return "";
	return m >= 1e3 ? `${(m / 1e3).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatDuration(s) {
	if (!Number.isFinite(s)) return "";
	const mins = Math.round(s / 60);
	if (mins < 60) return `${mins} min`;
	return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}
/** Human readable instruction from an OSRM step maneuver. */
function describeStep(step) {
	const road = step.name?.trim();
	const onto = road ? ` onto ${road}` : "";
	const type = step.maneuver?.type ?? "";
	const dir = (step.maneuver?.modifier ?? "").replace("slight ", "slight ").replace("sharp ", "sharp ");
	switch (type) {
		case "depart": return road ? `Head out on ${road}` : "Start driving";
		case "arrive": return "Arrive at the stop";
		case "turn": return `Turn ${dir || "ahead"}${onto}`;
		case "new name": return `Continue${onto}`;
		case "merge": return `Merge ${dir}${onto}`.replace("  ", " ");
		case "on ramp": return `Take the ramp ${dir}${onto}`.replace("  ", " ");
		case "off ramp": return `Take the exit ${dir}${onto}`.replace("  ", " ");
		case "fork": return `Keep ${dir || "ahead"}${onto}`;
		case "roundabout":
		case "rotary": return `Enter the roundabout and exit${onto}`;
		case "end of road": return `At the end of the road, turn ${dir || "ahead"}${onto}`;
		case "continue": return `Continue ${dir}${onto}`.replace("  ", " ");
		default: return `Continue${onto}`;
	}
}
/** OSRM road-snapped geometry + turn-by-turn steps, in SEQ order. Chunked for URL limits. */
async function fetchRoute(stops) {
	if (stops.length < 2) return {
		polyline: [],
		legs: []
	};
	const out = [];
	const legs = [];
	const CHUNK = 24;
	let offline = false;
	for (let i = 0; i < stops.length - 1; i += 23) {
		const part = stops.slice(i, i + CHUNK);
		if (part.length < 2) break;
		if (offline) {
			appendStraightLine(part, out, legs);
			continue;
		}
		const url = `https://router.project-osrm.org/route/v1/driving/${part.map((s) => `${s.lng},${s.lat}`).join(";")}?steps=true&geometries=geojson&overview=full`;
		let route = null;
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`OSRM request failed (${res.status})`);
			const data = await res.json();
			if (data.code !== "Ok" || !data.routes?.length) throw new Error("OSRM returned no route");
			route = data.routes[0];
		} catch (err) {
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
					distance: s.distance ?? 0
				}))
			});
		});
	}
	return {
		polyline: out,
		legs,
		offline
	};
}
/** Straight Haversine connectors used when the routing server can't be reached. */
function appendStraightLine(part, out, legs) {
	for (let i = 0; i < part.length - 1; i++) {
		const a = part[i];
		const b = part[i + 1];
		out.push([a.jLat, a.jLng], [b.jLat, b.jLng]);
		const distance = metresBetween([a.jLat, a.jLng], [b.jLat, b.jLng]);
		legs.push({
			fromSeq: a.seq,
			toSeq: b.seq,
			distance,
			duration: distance / 1e3 / 50 * 3600,
			steps: [{
				text: `Offline: head direct to ${b.seq || "next stop"}`,
				distance
			}]
		});
	}
}
/** Leading alpha prefix of a New SEQ value, e.g. "A" from "A001". "#" when none. */
function zoneOf(seq) {
	const m = String(seq ?? "").trim().match(/^([A-Za-z]+)/);
	return m ? m[1].toUpperCase() : "#";
}
function listZones(stops) {
	return Array.from(new Set(stops.map((s) => zoneOf(s.seq)))).sort();
}
function groupByZone(stops) {
	const map = /* @__PURE__ */ new Map();
	for (const s of stops) {
		const z = zoneOf(s.seq);
		const arr = map.get(z);
		if (arr) arr.push(s);
		else map.set(z, [s]);
	}
	return map;
}
var EARTH = 6371e3;
function metresBetween(a, b) {
	const dLat = (b[0] - a[0]) * Math.PI / 180;
	const dLng = (b[1] - a[1]) * Math.PI / 180;
	const lat1 = a[0] * Math.PI / 180;
	const lat2 = b[0] * Math.PI / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
/**
* Flag stops whose marker sits further than `threshold` metres from the nearest
* snapped road point on the route geometry (flag lots / parcels behind parcels).
*/
function detectOffRoad(stops, polyline, threshold = 30) {
	const out = /* @__PURE__ */ new Map();
	if (polyline.length < 2) return out;
	for (const s of stops) {
		let best = Infinity;
		let bestPt = polyline[0];
		for (const p of polyline) {
			const d = metresBetween([s.jLat, s.jLng], p);
			if (d < best) {
				best = d;
				bestPt = p;
			}
		}
		if (best > threshold) out.set(s.id, {
			id: s.id,
			snapped: bestPt,
			distance: best
		});
	}
	return out;
}
/** GeoNB parcel lookup helpers (ArcGIS REST). */
var PARCEL_LAYER_URL = "https://geonb.snb.ca/arcgis/rest/services/GeoNB_SNB_Parcels/MapServer/0";
function centroidOfRings(rings) {
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
function chunk(arr, size) {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}
/** Look up parcel centroids by PAN. Never throws — unmatched PANs are returned. */
async function lookupPans(pans, onProgress) {
	const clean = Array.from(new Set(pans.map((p) => p.trim()).filter(Boolean)));
	const matched = /* @__PURE__ */ new Map();
	const batches = chunk(clean, 60);
	let done = 0;
	for (const batch of batches) {
		const list = batch.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
		const params = new URLSearchParams({
			where: `PID IN (${list})`,
			outFields: "PID",
			returnGeometry: "true",
			outSR: "4326",
			f: "json"
		});
		try {
			const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				for (const f of data.features ?? []) {
					const attrs = f.attributes ?? {};
					const pan = String(attrs["PID"] ?? attrs["PAN"] ?? attrs["pan"] ?? "").trim();
					if (!pan) continue;
					let point = null;
					if (f.geometry?.rings) point = centroidOfRings(f.geometry.rings);
					else if (typeof f.geometry?.x === "number" && typeof f.geometry?.y === "number") point = [f.geometry.y, f.geometry.x];
					if (!point) continue;
					matched.set(pan, {
						pan,
						lat: point[0],
						lng: point[1]
					});
				}
			}
		} catch (err) {
			console.error("GeoNB PAN lookup batch failed", err);
		}
		done += batch.length;
		onProgress?.(Math.min(done, clean.length), clean.length);
	}
	return {
		matched,
		unmatched: clean.filter((p) => !matched.has(p))
	};
}
/** Resolve a single PAN (used by the manual fallback panel). */
async function lookupSinglePan(pan) {
	const { matched } = await lookupPans([pan]);
	return matched.get(pan.trim()) ?? null;
}
/**
* Fetch every parcel outline intersecting a map viewport (no PAN filtering).
* Used for the global GeoNB reference layer.
*/
async function fetchParcelsInBounds(bbox, maxRecords = 2e3) {
	const out = /* @__PURE__ */ new Map();
	const params = new URLSearchParams({
		where: "1=1",
		geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
		geometryType: "esriGeometryEnvelope",
		inSR: "4326",
		spatialRel: "esriSpatialRelIntersects",
		outFields: "PID",
		returnGeometry: "true",
		outSR: "4326",
		resultRecordCount: String(maxRecords),
		f: "json"
	});
	try {
		const res = await fetch(`${PARCEL_LAYER_URL}/query?${params.toString()}`);
		if (!res.ok) return out;
		const data = await res.json();
		for (const f of data.features ?? []) {
			const pan = String(f.attributes?.["PID"] ?? f.attributes?.["PAN"] ?? f.attributes?.["pan"] ?? "").trim();
			const rings = f.geometry?.rings;
			if (!rings?.length) continue;
			const key = pan || `${rings[0]?.[0]?.[0]},${rings[0]?.[0]?.[1]}`;
			out.set(key, {
				pan,
				rings: rings.map((ring) => ring.map(([x, y]) => [y, x]))
			});
		}
	} catch (err) {
		console.error("GeoNB viewport parcel fetch failed", err);
	}
	return out;
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var Accordion = Root2;
var AccordionItem = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
	ref,
	className: cn("border-b", className),
	...props
}));
AccordionItem.displayName = "AccordionItem";
var AccordionTrigger = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
	className: "flex",
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Trigger2, {
		ref,
		className: cn("flex flex-1 items-center justify-between py-4 text-sm font-medium cursor-pointer transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" })]
	})
}));
AccordionTrigger.displayName = Trigger2.displayName;
var AccordionContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: "overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("pb-4 pt-0", className),
		children
	})
}));
AccordionContent.displayName = Content2.displayName;
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
			outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
			secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var badgeVariants = cva("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
	variants: { variant: {
		default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
		secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
		destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
		outline: "text-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
var Switch = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
	className: cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input", className),
	...props,
	ref,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: cn("pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0") })
}));
Switch.displayName = Switch$1.displayName;
var labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn(labelVariants(), className),
	...props
}));
Label.displayName = Root.displayName;
var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
	ref,
	className: cn("fixed inset-0 z-[9998] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props
}));
DialogOverlay.displayName = DialogOverlay$1.displayName;
var DialogContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-[9999] grid max-h-[90vh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
		className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "Close"
		})]
	})]
})] }));
DialogContent.displayName = DialogContent$1.displayName;
var DialogHeader = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className),
	...props
});
DialogHeader.displayName = "DialogHeader";
var DialogFooter = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
DialogFooter.displayName = "DialogFooter";
var DialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
	ref,
	className: cn("text-lg font-semibold leading-none tracking-tight", className),
	...props
}));
DialogTitle.displayName = DialogTitle$1.displayName;
var DialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
DialogDescription.displayName = DialogDescription$1.displayName;
var RadioGroup = import_react.forwardRef(({ className, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup$1, {
		className: cn("grid gap-2", className),
		...props,
		ref
	});
});
RadioGroup.displayName = RadioGroup$1.displayName;
var RadioGroupItem = import_react.forwardRef(({ className, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroupItem$1, {
		ref,
		className: cn("aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroupIndicator, {
			className: "flex items-center justify-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, { className: "h-3.5 w-3.5 fill-primary" })
		})
	});
});
RadioGroupItem.displayName = RadioGroupItem$1.displayName;
var R = 6371e3;
function haversine(a, b) {
	const dLat = (b[0] - a[0]) * Math.PI / 180;
	const dLng = (b[1] - a[1]) * Math.PI / 180;
	const lat1 = a[0] * Math.PI / 180;
	const lat2 = b[0] * Math.PI / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/**
* Group contiguous sequential stops into spatial sectors: a stop joins the
* current page while the page is under `max` stops and the stop sits within
* `radius` metres of the running page centroid.
*/
function groupBySector(stops, max, radius) {
	const pages = [];
	let current = [];
	let sumLat = 0;
	let sumLng = 0;
	const flush = () => {
		if (!current.length) return;
		pages.push({
			title: `Sector ${pages.length + 1} · ${current[0].seq || "?"} – ${current[current.length - 1].seq || "?"}`,
			stops: current
		});
		current = [];
		sumLat = 0;
		sumLng = 0;
	};
	for (const s of stops) {
		if (current.length) {
			if (haversine([sumLat / current.length, sumLng / current.length], [s.jLat, s.jLng]) > radius || current.length >= max) flush();
		}
		current.push(s);
		sumLat += s.jLat;
		sumLng += s.jLng;
	}
	flush();
	return pages;
}
function buildPrintPages(stops, mode) {
	if (!stops.length) return [];
	if (mode === "master") return [{
		title: "Master overview",
		stops
	}];
	if (mode === "detailed") return groupBySector(stops, 25, 400);
	return groupBySector(stops, 60, 500);
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => RouteOptimizerPage });
var RouteMap = (0, import_react.lazy)(() => import("./RouteMap-nj2fivFF.mjs"));
var PrintBooklet = (0, import_react.lazy)(() => import("./PrintBooklet-1-t1Q6Ny.mjs"));
var STORAGE_KEY = "route-optimizer-state-v1";
function loadState() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed.stops)) return null;
		return {
			stops: parsed.stops,
			polyline: Array.isArray(parsed.polyline) ? parsed.polyline : [],
			zoneRoutes: Array.isArray(parsed.zoneRoutes) ? parsed.zoneRoutes : [],
			config: {
				...DEFAULT_MAP_CONFIG,
				...parsed.config ?? {}
			},
			fileName: parsed.fileName ?? "",
			directions: Array.isArray(parsed.directions) ? parsed.directions : [],
			unmatched: Array.isArray(parsed.unmatched) ? parsed.unmatched : []
		};
	} catch (err) {
		console.error("Failed to rehydrate saved route", err);
		return null;
	}
}
function RouteOptimizerPage() {
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	const [stops, setStops] = (0, import_react.useState)([]);
	const [polyline, setPolyline] = (0, import_react.useState)([]);
	const [zoneRoutes, setZoneRoutes] = (0, import_react.useState)([]);
	const [directions, setDirections] = (0, import_react.useState)([]);
	const [config, setConfig] = (0, import_react.useState)(DEFAULT_MAP_CONFIG);
	const [fileName, setFileName] = (0, import_react.useState)("");
	const [unmatched, setUnmatched] = (0, import_react.useState)([]);
	const [resolveInputs, setResolveInputs] = (0, import_react.useState)({});
	const [resolving, setResolving] = (0, import_react.useState)(null);
	const [routing, setRouting] = (0, import_react.useState)(false);
	const [matching, setMatching] = (0, import_react.useState)(false);
	const [dragActive, setDragActive] = (0, import_react.useState)(false);
	const [tracking, setTracking] = (0, import_react.useState)(false);
	const [sidebarOpen, setSidebarOpen] = (0, import_react.useState)(true);
	const [openLegs, setOpenLegs] = (0, import_react.useState)([]);
	const [resizeSignal, setResizeSignal] = (0, import_react.useState)(0);
	const [activeZone, setActiveZone] = (0, import_react.useState)(null);
	const [showArrows, setShowArrows] = (0, import_react.useState)(true);
	const [activeLegOnly, setActiveLegOnly] = (0, import_react.useState)(false);
	const [basemap, setBasemap] = (0, import_react.useState)("street");
	const [query, setQuery] = (0, import_react.useState)("");
	const [searchOpen, setSearchOpen] = (0, import_react.useState)(false);
	const [highlightPan, setHighlightPan] = (0, import_react.useState)(null);
	const [expandedId, setExpandedId] = (0, import_react.useState)(null);
	const [focus, setFocus] = (0, import_react.useState)(null);
	const [uploadOpen, setUploadOpen] = (0, import_react.useState)(false);
	const [coordSource, setCoordSource] = (0, import_react.useState)("csv");
	const [pendingFile, setPendingFile] = (0, import_react.useState)(null);
	const [printOpen, setPrintOpen] = (0, import_react.useState)(false);
	const [printMode, setPrintMode] = (0, import_react.useState)("compact");
	const [printPages, setPrintPages] = (0, import_react.useState)(null);
	const [preparingPrint, setPreparingPrint] = (0, import_react.useState)(false);
	const fileInputRef = (0, import_react.useRef)(null);
	const mapHandle = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
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
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
				stops,
				polyline,
				zoneRoutes,
				config,
				fileName,
				directions,
				unmatched
			}));
		} catch (err) {
			console.error("Failed to persist route state", err);
		}
	}, [
		hydrated,
		stops,
		polyline,
		zoneRoutes,
		config,
		fileName,
		directions,
		unmatched
	]);
	const zones = (0, import_react.useMemo)(() => listZones(stops), [stops]);
	const visibleStops = (0, import_react.useMemo)(() => activeZone ? stops.filter((s) => s.seq.toUpperCase().startsWith(activeZone)) : stops, [stops, activeZone]);
	const legs = (0, import_react.useMemo)(() => buildLegs(visibleStops, 10), [visibleStops]);
	const legsRef = (0, import_react.useRef)([]);
	legsRef.current = legs;
	const offRoad = (0, import_react.useMemo)(() => detectOffRoad(stops, polyline, 30), [stops, polyline]);
	const suggestions = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return visibleStops.filter((s) => s.pan.toLowerCase().includes(q) || s.seq.toLowerCase().includes(q)).slice(0, 8);
	}, [query, visibleStops]);
	const focusStop = (0, import_react.useCallback)((stop) => {
		setHighlightPan(stop.pan || null);
		setExpandedId(stop.id);
		setFocus({
			lat: stop.jLat,
			lng: stop.jLng,
			nonce: Date.now()
		});
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
	const buildRoute = (0, import_react.useCallback)(async (list) => {
		if (list.length < 2) {
			setPolyline([]);
			setZoneRoutes([]);
			setDirections([]);
			return;
		}
		setRouting(true);
		try {
			const byZone = groupByZone(list);
			const routes = [];
			const allLegs = [];
			const all = [];
			for (const [zone, zoneStops] of byZone) {
				if (zoneStops.length < 2) continue;
				const result = await fetchRoute(zoneStops);
				routes.push({
					zone,
					polyline: result.polyline
				});
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
	const parseCsv = (0, import_react.useCallback)(async (file, mode) => {
		const text = await file.text();
		const rows = import_papaparse.default.parse(text, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (h) => h.trim()
		}).data ?? [];
		const cols = detectColumns(Object.keys(rows[0] ?? {}));
		const raw = rows.map((row) => ({
			pan: cols.pan ? String(row[cols.pan] ?? "").trim() : "",
			seq: cols.seq ? String(row[cols.seq] ?? "").trim() : "",
			lat: cols.lat ? parseFloat(String(row[cols.lat] ?? "").trim()) : NaN,
			lng: cols.lng ? parseFloat(String(row[cols.lng] ?? "").trim()) : NaN
		}));
		let parsed = [];
		let missing = [];
		if (mode === "csv") {
			if (!cols.lat || !cols.lng) {
				toast.error("No latitude/longitude columns found in that CSV.");
				return;
			}
			parsed = raw.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)).map((r) => ({
				pan: r.pan,
				seq: r.seq,
				lat: r.lat,
				lng: r.lng
			}));
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
					if (hit) parsed.push({
						pan: r.pan,
						seq: r.seq,
						lat: hit.lat,
						lng: hit.lng
					});
					else if (Number.isFinite(r.lat) && Number.isFinite(r.lng)) parsed.push({
						pan: r.pan,
						seq: r.seq,
						lat: r.lat,
						lng: r.lng
					});
					else missing.push({
						pan: r.pan,
						seq: r.seq
					});
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
		toast.success(`Loaded ${prepared.length} stops${missing.length ? ` · ${missing.length} unmatched` : ""}`);
		buildRoute(prepared);
	}, [buildRoute]);
	const handleFile = (0, import_react.useCallback)((file) => {
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
	const resolveUnmatched = async (pan) => {
		const alt = (resolveInputs[pan] ?? "").trim();
		if (!alt) {
			toast.error("Enter a parent PAN or lat,lng first.");
			return;
		}
		setResolving(pan);
		try {
			let coords = null;
			const m = alt.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
			if (m) coords = [parseFloat(m[1]), parseFloat(m[3])];
			else {
				const hit = await lookupSinglePan(alt);
				if (hit) coords = [hit.lat, hit.lng];
			}
			if (!coords) {
				toast.error(`No GeoNB parcel found for ${alt}`);
				return;
			}
			const entry = unmatched.find((u) => u.pan === pan);
			const next = prepareStops([...stops.map((s) => ({
				pan: s.pan,
				seq: s.seq,
				lat: s.lat,
				lng: s.lng
			})), {
				pan,
				seq: entry?.seq ?? "",
				lat: coords[0],
				lng: coords[1]
			}]);
			setStops(next);
			setUnmatched((list) => list.filter((u) => u.pan !== pan));
			toast.success(`Resolved PAN ${pan}`);
			buildRoute(next);
		} catch (err) {
			console.error("Manual PAN resolve failed", err);
			toast.error("Lookup failed. Try coordinates instead (lat,lng).");
		} finally {
			setResolving(null);
		}
	};
	const onDrop = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		const file = e.dataTransfer?.files?.[0];
		if (file) handleFile(file);
	};
	const stopEvent = (e, active) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(active);
	};
	const onSubmit = (e) => {
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
	(0, import_react.useEffect)(() => {
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
	(0, import_react.useEffect)(() => {
		if (!printPages) return;
		document.body.classList.add("printing-booklet");
		mapHandle.current?.getMap()?.invalidateSize();
		let inner;
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
		const L = (await import("../_libs/leaflet.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()))).default;
		map.fitBounds(L.latLngBounds(visibleStops.map((s) => [s.jLat, s.jLng])), { padding: [40, 40] });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "app-shell relative h-screen w-full overflow-hidden bg-background text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: toggleSidebar,
				className: "no-print fixed left-3 top-3 z-[10000] rounded-lg bg-primary p-2.5 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90",
				"aria-label": sidebarOpen ? "Collapse sidebar" : "Expand sidebar",
				children: sidebarOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-4" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-full min-h-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: `no-print ${sidebarOpen ? "flex" : "hidden"} h-full min-h-0 w-full ${mapVisible ? "max-w-full sm:max-w-sm md:w-96" : "max-w-full"} shrink-0 flex-col overflow-hidden border-r border-border bg-card`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "shrink-0 space-y-3 border-b border-border bg-card p-4 pl-16",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-w-0 items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, { className: "size-5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "truncate text-base font-semibold tracking-tight",
										children: "Route Optimizer"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-xs text-muted-foreground",
										children: stops.length ? `${stops.length} stops · ${legs.length} legs` : "No route loaded"
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								size: "sm",
								variant: "secondary",
								onClick: toggleSidebar,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeftClose, { className: "size-4" }), " Expand map"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: query,
									onChange: (e) => {
										setQuery(e.target.value);
										setSearchOpen(true);
									},
									onFocus: () => setSearchOpen(true),
									onBlur: () => setTimeout(() => setSearchOpen(false), 150),
									placeholder: "Search PAN or SEQ (e.g. A166, 12345678)",
									className: "h-9 w-full pl-8 text-xs",
									"aria-label": "Search PAN or SEQ"
								}),
								searchOpen && suggestions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "absolute left-0 top-11 z-[10001] w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl",
									children: suggestions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onMouseDown: (e) => e.preventDefault(),
										onClick: () => focusStop(s),
										className: "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											className: "font-mono",
											children: s.seq || "—"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "truncate",
											children: ["PAN ", s.pan || "—"]
										})]
									}) }, s.id))
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-h-0 flex-1 overflow-y-auto",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Accordion, {
							type: "multiple",
							defaultValue: ["layers"],
							className: "px-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
									value: "layers",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
										className: "text-xs font-semibold uppercase tracking-wide",
										children: "Map View & Layers"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionContent, {
										className: "space-y-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex overflow-hidden rounded-md border border-border",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => setBasemap("street"),
													className: `flex-1 px-2 py-1.5 text-[11px] font-semibold transition-colors ${basemap === "street" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`,
													children: "Street Map"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => setBasemap("satellite"),
													className: `flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold transition-colors ${basemap === "satellite" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Satellite, { className: "size-3" }), " Satellite Aerial"]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
													htmlFor: "parcels",
													className: "text-xs",
													children: "GeoNB parcels"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
													id: "parcels",
													checked: config.showParcels,
													onCheckedChange: (v) => setConfig((c) => ({
														...c,
														showParcels: v
													}))
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
													htmlFor: "pan-labels",
													className: "text-xs",
													children: "Show Parcel PANs"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
													id: "pan-labels",
													checked: config.showPanLabels,
													onCheckedChange: (v) => setConfig((c) => ({
														...c,
														showPanLabels: v
													}))
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												type: "button",
												size: "sm",
												variant: tracking ? "default" : "outline",
												className: "w-full",
												onClick: () => setTracking((t) => !t),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocateFixed, { className: "size-4" }), tracking ? "Stop GPS" : "Track My Location"]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
									value: "zones",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
										className: "text-xs font-semibold uppercase tracking-wide",
										children: "Zone & Navigation Controls"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionContent, {
										className: "space-y-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-wrap gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => setActiveZone(null),
													className: `rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors ${activeZone === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`,
													children: "All Zones"
												}), zones.map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => setActiveZone(z),
													className: `rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors ${activeZone === z ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`,
													children: ["Zone ", z]
												}, z))]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
													htmlFor: "arrows",
													className: "text-xs",
													children: "Show Route Arrows"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
													id: "arrows",
													checked: showArrows,
													onCheckedChange: setShowArrows
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
													htmlFor: "active-leg",
													className: "text-xs",
													children: "Active Leg Only"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
													id: "active-leg",
													checked: activeLegOnly,
													onCheckedChange: setActiveLegOnly
												})]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
									value: "actions",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
										className: "text-xs font-semibold uppercase tracking-wide",
										children: "Route Actions"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionContent, {
										className: "space-y-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											type: "button",
											variant: "outline",
											size: "sm",
											className: "w-full",
											disabled: !stops.length,
											onClick: () => void fitRoute(),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, { className: "size-4" }), " Fit Route"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											type: "button",
											size: "sm",
											className: "w-full",
											disabled: preparingPrint,
											onClick: () => setPrintOpen(true),
											children: [preparingPrint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }), "Print Route Field Booklet"]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
									value: "import",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
										className: "text-xs font-semibold uppercase tracking-wide",
										children: "Data Import"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionContent, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
										onSubmit,
										className: "space-y-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											onDragEnter: (e) => stopEvent(e, true),
											onDragOver: (e) => stopEvent(e, true),
											onDragLeave: (e) => stopEvent(e, false),
											onDrop,
											onClick: () => fileInputRef.current?.click(),
											className: `cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${dragActive ? "border-primary bg-accent" : "border-border bg-muted/40 hover:border-primary/50"}`,
											children: [
												matching ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mx-auto size-5 animate-spin text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "mx-auto size-5 text-muted-foreground" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "mt-2 text-sm font-medium",
													children: matching ? "Matching PANs against GeoNB…" : "Drop a stops CSV"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-xs text-muted-foreground",
													children: fileName || "Latitude, Longitude, PAN, New SEQ"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													ref: fileInputRef,
													type: "file",
													accept: ".csv,text/csv",
													className: "hidden",
													onChange: (e) => {
														const file = e.target.files?.[0];
														if (file) handleFile(file);
														if (fileInputRef.current) fileInputRef.current.value = "";
													}
												})
											]
										}), stops.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												type: "button",
												variant: "outline",
												size: "sm",
												className: "flex-1",
												disabled: routing,
												onClick: () => void buildRoute(stops),
												children: [routing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-4" }), "Re-snap route"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												type: "button",
												variant: "ghost",
												size: "sm",
												onClick: clearAll,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" }), " Clear"]
											})]
										})]
									}) })]
								}),
								unmatched.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
									value: "unmatched",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
										className: "text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4" }),
												" Unmatched Properties (",
												unmatched.length,
												")"
											]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionContent, {
										className: "space-y-2",
										children: unmatched.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "rounded-lg border border-border bg-background p-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-sm font-medium",
													children: ["PAN ", u.pan || "—"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "mb-2 text-xs text-muted-foreground",
													children: ["SEQ ", u.seq || "—"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
														value: resolveInputs[u.pan] ?? "",
														onChange: (e) => setResolveInputs((m) => ({
															...m,
															[u.pan]: e.target.value
														})),
														placeholder: "Parent PAN or lat,lng",
														className: "h-8 text-xs"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
														type: "button",
														size: "sm",
														className: "h-8",
														disabled: resolving === u.pan,
														onClick: () => void resolveUnmatched(u.pan),
														children: resolving === u.pan ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin" }) : "Resolve"
													})]
												})
											]
										}, u.pan))
									})]
								}),
								directions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
									value: "directions",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
										className: "text-xs font-semibold uppercase tracking-wide",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListOrdered, { className: "size-4" }), " Written directions"]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionContent, {
										className: "space-y-3",
										children: directions.map((leg, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "rounded-lg border border-border p-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "text-sm font-semibold",
													children: [
														leg.fromSeq,
														" → ",
														leg.toSeq
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "mb-2 text-xs text-muted-foreground",
													children: [
														formatDistance(leg.distance),
														" · ",
														formatDuration(leg.duration)
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
													className: "space-y-1",
													children: leg.steps.map((step, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
														className: "flex gap-2 text-xs",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "font-mono text-muted-foreground",
															children: [j + 1, "."]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [step.text, step.distance > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-muted-foreground",
															children: [
																" ",
																"(",
																formatDistance(step.distance),
																")"
															]
														})] })]
													}, j))
												})
											]
										}, i))
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 pt-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
									children: ["Route legs", activeZone ? ` · Zone ${activeZone}` : ""]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Accordion, {
									type: "multiple",
									value: openLegs,
									onValueChange: setOpenLegs,
									className: "space-y-2",
									children: legs.map((leg, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
										value: `leg-${i}`,
										className: "rounded-lg border border-border px-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
											className: "text-sm",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "truncate",
												children: [
													"Leg ",
													i + 1,
													": ",
													leg[0]?.seq,
													" → ",
													leg[leg.length - 1]?.seq,
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "ml-1 text-xs text-muted-foreground",
														children: [
															"(",
															leg.length,
															" stops)"
														]
													})
												]
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionContent, {
											className: "space-y-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
												href: googleMapsUrl(leg),
												target: "_blank",
												rel: "noopener noreferrer",
												className: "flex w-full items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rocket, { className: "size-4 shrink-0" }),
													"Launch Leg ",
													i + 1,
													" in Google Maps"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
												className: "space-y-2",
												children: leg.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
													id: `stop-${s.id}`,
													onClick: () => focusStop(s),
													className: `cursor-pointer rounded-lg border bg-background p-3 transition-colors ${expandedId === s.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`,
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-3",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
																className: `shrink-0 font-mono ${offRoad.has(s.id) ? "bg-amber-500 text-white hover:bg-amber-500" : ""}`,
																children: [s.seq || "—", offRoad.has(s.id) ? " ↗" : ""]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "min-w-0 flex-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
																	className: "truncate text-sm font-medium",
																	children: ["PAN ", s.pan || "—"]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																	className: "text-xs text-muted-foreground",
																	children: offRoad.has(s.id) ? `Set back ${Math.round(offRoad.get(s.id).distance)} m from road` : `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
																href: directNavUrl(s),
																target: "_blank",
																rel: "noopener noreferrer",
																onClick: (e) => e.stopPropagation(),
																"aria-label": `Navigate to ${s.seq}`,
																className: "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-accent",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-4" })
															})
														]
													})
												}, s.id))
											})]
										})]
									}, i))
								}),
								!stops.length && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "mx-auto mb-2 size-5" }), "Upload a CSV to build your route."]
								})
							]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: `map-shell relative min-w-0 flex-1 ${mapVisible ? "" : "hidden"}`,
					children: hydrated && mapVisible ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
						fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-full items-center justify-center text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-5 animate-spin" })
						}),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RouteMap, {
							handleRef: mapHandle,
							stops,
							polyline,
							zoneRoutes,
							activeZone,
							offRoad,
							showParcels: config.showParcels,
							showPanLabels: config.showPanLabels,
							tracking,
							config,
							showArrows,
							activeLegOnly,
							resizeSignal,
							basemap,
							highlightPan,
							focus,
							onViewChange: (center, zoom) => setConfig((c) => c.zoom === zoom && c.center[0] === center[0] && c.center[1] === center[1] ? c : {
								...c,
								center,
								zoom
							})
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full bg-muted" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: uploadOpen,
				onOpenChange: setUploadOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "no-print",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Import stops" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
							"Choose where the coordinates for ",
							pendingFile?.name ?? "this file",
							" come from."
						] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(RadioGroup, {
							value: coordSource,
							onValueChange: (v) => setCoordSource(v),
							className: "gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroupItem, {
									value: "csv",
									id: "src-csv",
									className: "mt-1"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-medium",
									children: "Use coordinates from CSV"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-xs text-muted-foreground",
									children: "Reads Latitude & Longitude directly from the file."
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroupItem, {
									value: "geonb",
									id: "src-geonb",
									className: "mt-1"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-medium",
									children: "Auto-match coordinates via GeoNB layer"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-xs text-muted-foreground",
									children: "Only needs PAN & New SEQ. Unmatched PANs are listed for manual fixing."
								})] })]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setUploadOpen(false),
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => void confirmUpload(),
							children: "Import"
						})] })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: printOpen,
				onOpenChange: setPrintOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "no-print",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "🖨️ Print Route Field Booklet" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
							"Pick a print density. ",
							visibleStops.length,
							" stops will be included",
							activeZone ? ` (Zone ${activeZone})` : "",
							"."
						] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
							value: printMode,
							onValueChange: (v) => setPrintMode(v),
							className: "gap-3",
							children: [
								{
									v: "compact",
									t: "Compact sector view",
									d: "~50–70 stops per page, grouped by 500 m spatial sectors."
								},
								{
									v: "detailed",
									t: "Detailed block view",
									d: "~25 stops per page at high zoom."
								},
								{
									v: "master",
									t: "Master map + manifest only",
									d: "One overview map, then multi-column check-sheets."
								}
							].map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroupItem, {
									value: o.v,
									id: `pm-${o.v}`,
									className: "mt-1"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-medium",
									children: o.t
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-xs text-muted-foreground",
									children: o.d
								})] })]
							}, o.v))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setPrintOpen(false),
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => void startPrint(),
							children: "Build booklet"
						})] })
					]
				})
			}),
			printPages && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
				fallback: null,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrintBooklet, {
					pages: printPages,
					mode: printMode,
					polyline,
					allStops: visibleStops,
					title: fileName || "Route"
				})
			})
		]
	});
}
//#endregion
export { fetchParcelsInBounds as n, zoneOf as r, routes_exports as t };
