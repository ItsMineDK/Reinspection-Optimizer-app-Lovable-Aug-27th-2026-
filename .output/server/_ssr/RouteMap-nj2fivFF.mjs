import { i as __toESM } from "../_runtime.mjs";
import { b as require_react, y as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as require_leaflet_src } from "../_libs/leaflet.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as fetchParcelsInBounds, r as zoneOf } from "./routes-BrQcu__V.mjs";
import { t as require_leaflet_polylineDecorator } from "../_libs/leaflet-polylinedecorator.mjs";
import { t as require_leaflet_polylineoffset } from "../_libs/leaflet-polylineoffset.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/RouteMap-nj2fivFF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_leaflet_src = /* @__PURE__ */ __toESM(require_leaflet_src());
require_leaflet_polylineDecorator();
require_leaflet_polylineoffset();
var STREET_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
var SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
function RouteMap({ stops, polyline, zoneRoutes, activeZone, offRoad, showParcels, showPanLabels, showArrows = true, activeLegOnly = false, tracking, config, resizeSignal, basemap = "street", highlightPan, focus, onViewChange, handleRef }) {
	const containerRef = (0, import_react.useRef)(null);
	const mapRef = (0, import_react.useRef)(null);
	const markersRef = (0, import_react.useRef)(null);
	const routeRef = (0, import_react.useRef)(null);
	const accessRef = (0, import_react.useRef)(null);
	const parcelsRef = (0, import_react.useRef)(null);
	const parcelDataRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const tileRef = (0, import_react.useRef)(null);
	const highlightRef = (0, import_react.useRef)(null);
	highlightRef.current = highlightPan ?? null;
	const labelsRef = (0, import_react.useRef)(null);
	const gpsRef = (0, import_react.useRef)(null);
	const viewCbRef = (0, import_react.useRef)(onViewChange);
	viewCbRef.current = onViewChange;
	const didFit = (0, import_react.useRef)(false);
	const panLabelsOn = (0, import_react.useRef)(showPanLabels);
	panLabelsOn.current = showPanLabels;
	const parcelsOn = (0, import_react.useRef)(showParcels);
	parcelsOn.current = showParcels;
	const zoomToastRef = (0, import_react.useRef)(0);
	(0, import_react.useImperativeHandle)(handleRef, () => ({ getMap: () => mapRef.current }), []);
	(0, import_react.useEffect)(() => {
		if (!containerRef.current || mapRef.current) return;
		const map = import_leaflet_src.default.map(containerRef.current, {
			center: config.center,
			zoom: config.zoom,
			zoomControl: false,
			preferCanvas: false
		});
		import_leaflet_src.default.control.zoom({ position: "bottomleft" }).addTo(map);
		map.createPane("parcelPane");
		const parcelPane = map.getPane("parcelPane");
		if (parcelPane) parcelPane.style.zIndex = "350";
		map.createPane("panLabelPane");
		const labelPane = map.getPane("panLabelPane");
		if (labelPane) {
			labelPane.style.zIndex = "360";
			labelPane.style.pointerEvents = "none";
		}
		tileRef.current = import_leaflet_src.default.tileLayer(STREET_URL, {
			maxZoom: 19,
			crossOrigin: true,
			attribution: "&copy; OpenStreetMap contributors"
		}).addTo(map);
		map.dragging.enable();
		map.scrollWheelZoom.enable();
		markersRef.current = import_leaflet_src.default.layerGroup().addTo(map);
		parcelsRef.current = import_leaflet_src.default.layerGroup();
		labelsRef.current = import_leaflet_src.default.layerGroup();
		if (parcelsOn.current) parcelsRef.current.addTo(map);
		if (panLabelsOn.current) labelsRef.current.addTo(map);
		routeRef.current = import_leaflet_src.default.layerGroup().addTo(map);
		accessRef.current = import_leaflet_src.default.layerGroup().addTo(map);
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
	}, []);
	(0, import_react.useEffect)(() => {
		if (!mapRef.current || !tileRef.current) return;
		tileRef.current.setUrl(basemap === "satellite" ? SATELLITE_URL : STREET_URL);
		tileRef.current.options.attribution = basemap === "satellite" ? "Imagery &copy; Esri, Maxar, Earthstar Geographics" : "&copy; OpenStreetMap contributors";
	}, [basemap]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map || !focus) return;
		map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 17), { duration: .8 });
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
			const poly = import_leaflet_src.default.polygon(parcel.rings, {
				color: highlighted ? "#f59e0b" : "#0f172a",
				weight: highlighted ? 4 : 2,
				opacity: highlighted ? 1 : .85,
				fillColor: "#6366f1",
				fillOpacity: highlighted ? .2 : .08,
				interactive: false,
				pane: "parcelPane"
			});
			if (!bounds.intersects(poly.getBounds())) continue;
			poly.addTo(group);
		}
		group.eachLayer((l) => l.bringToBack?.());
	};
	(0, import_react.useEffect)(() => {
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
	}, [showParcels]);
	(0, import_react.useEffect)(() => {
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
	}, [showPanLabels]);
	const fetchSeq = (0, import_react.useRef)(0);
	const loadViewportParcels = () => {
		const map = mapRef.current;
		if (!map) return;
		if (!parcelsOn.current && !panLabelsOn.current) {
			parcelDataRef.current = /* @__PURE__ */ new Map();
			renderParcels();
			labelsRef.current?.clearLayers();
			return;
		}
		if (map.getZoom() < 13) {
			parcelDataRef.current = /* @__PURE__ */ new Map();
			renderParcels();
			labelsRef.current?.clearLayers();
			const now = Date.now();
			if (now - zoomToastRef.current > 8e3) {
				zoomToastRef.current = now;
				toast("Zoom in to load GeoNB parcels");
			}
			return;
		}
		const b = map.getBounds();
		const id = ++fetchSeq.current;
		fetchParcelsInBounds({
			west: b.getWest(),
			south: b.getSouth(),
			east: b.getEast(),
			north: b.getNorth()
		}).then((data) => {
			if (id !== fetchSeq.current) return;
			parcelDataRef.current = data;
			renderParcels();
			refreshLabels();
		});
	};
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map) return;
		let timer = null;
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
	}, [showParcels, showPanLabels]);
	(0, import_react.useEffect)(() => {
		renderParcels();
	}, [highlightPan]);
	const refreshLabels = () => {
		const map = mapRef.current;
		const group = labelsRef.current;
		if (!map || !group) return;
		group.clearLayers();
		if (!panLabelsOn.current) return;
		if (map.getZoom() < 13) {
			const now = Date.now();
			if (now - zoomToastRef.current > 8e3) {
				zoomToastRef.current = now;
				toast("Zoom in to see PAN labels");
			}
			return;
		}
		const bounds = map.getBounds();
		for (const parcel of parcelDataRef.current.values()) {
			const pan = parcel.pan;
			const center = import_leaflet_src.default.polygon(parcel.rings).getBounds().getCenter();
			if (!pan || !bounds.contains(center)) continue;
			import_leaflet_src.default.marker(center, {
				interactive: false,
				pane: "panLabelPane",
				icon: import_leaflet_src.default.divIcon({
					className: "pan-label-wrapper",
					html: `<div class="pan-label">${pan}</div>`,
					iconSize: [70, 16],
					iconAnchor: [35, 8]
				})
			}).addTo(group);
		}
	};
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map) return;
		refreshLabels();
		const handler = () => refreshLabels();
		map.on("moveend zoomend", handler);
		return () => {
			map.off("moveend zoomend", handler);
		};
	}, [showPanLabels, showParcels]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map) return;
		const t = setTimeout(() => map.invalidateSize(), 260);
		return () => clearTimeout(t);
	}, [resizeSignal]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map) return;
		const onFound = (e) => {
			if (!gpsRef.current) gpsRef.current = import_leaflet_src.default.marker(e.latlng, {
				icon: import_leaflet_src.default.divIcon({
					className: "gps-dot-wrapper",
					html: "<div class=\"gps-dot\"></div>",
					iconSize: [22, 22],
					iconAnchor: [11, 11]
				}),
				zIndexOffset: 1e3
			}).addTo(map);
			else gpsRef.current.setLatLng(e.latlng);
		};
		const onError = (e) => console.error("GPS error", e.message);
		if (tracking) {
			map.on("locationfound", onFound);
			map.on("locationerror", onError);
			map.locate({
				setView: true,
				watch: true,
				enableHighAccuracy: true,
				maxZoom: 17
			});
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
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		const group = markersRef.current;
		const access = accessRef.current;
		if (!map || !group || !access) return;
		group.clearLayers();
		access.clearLayers();
		stops.forEach((s) => {
			const off = offRoad?.get(s.id);
			const inZone = !activeZone || zoneOf(s.seq) === activeZone;
			const icon = import_leaflet_src.default.divIcon({
				className: `seq-pin-wrapper${inZone ? "" : " seq-muted"}`,
				html: `<div class="seq-pin${off ? " seq-pin-offroad" : ""}">${s.seq || "?"}${off ? " ↗" : ""}</div>`,
				iconSize: [46, 26],
				iconAnchor: [23, 26]
			});
			import_leaflet_src.default.marker([s.jLat, s.jLng], { icon }).bindPopup(`<strong>SEQ ${s.seq}</strong><br/>PAN ${s.pan}${off ? `<br/><em>Set back ${Math.round(off.distance)} m from the road</em>` : ""}`).addTo(group);
			if (off && inZone) import_leaflet_src.default.polyline([off.snapped, [s.jLat, s.jLng]], {
				color: "#f59e0b",
				weight: 2,
				opacity: .9,
				dashArray: "5,6"
			}).addTo(access);
		});
		if (stops.length && !didFit.current) {
			didFit.current = true;
			map.fitBounds(import_leaflet_src.default.latLngBounds(stops.map((s) => [s.jLat, s.jLng])), { padding: [40, 40] });
		}
	}, [
		stops,
		offRoad,
		activeZone
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		const group = routeRef.current;
		if (!map || !group) return;
		group.clearLayers();
		const segments = zoneRoutes && zoneRoutes.length ? zoneRoutes : polyline.length > 1 ? [{
			zone: "#",
			polyline
		}] : [];
		for (const seg of segments) {
			if (seg.polyline.length < 2) continue;
			const active = !activeZone || seg.zone === activeZone;
			const line = import_leaflet_src.default.polyline(seg.polyline, {
				color: active ? "#4f46e5" : "#94a3b8",
				weight: active ? 5 : 3,
				opacity: active ? .65 : .18,
				smoothFactor: 1,
				lineJoin: "round",
				offset: 4
			}).addTo(group);
			if (!active) continue;
			if (!showArrows) continue;
			if (activeLegOnly && (!activeZone || seg.zone !== activeZone)) continue;
			const deco = import_leaflet_src.default;
			if (typeof deco.polylineDecorator === "function") try {
				deco.polylineDecorator(line, { patterns: [{
					offset: 25,
					repeat: "200px",
					symbol: deco.Symbol.arrowHead({
						pixelSize: 10,
						polygon: false,
						pathOptions: {
							stroke: true,
							color: "#1e1b4b",
							weight: 3,
							opacity: .9,
							fillOpacity: .8
						}
					})
				}] }).addTo(group);
			} catch (err) {
				console.error("Failed to render route arrows", err);
			}
		}
	}, [
		polyline,
		zoneRoutes,
		activeZone,
		showArrows,
		activeLegOnly
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: containerRef,
		id: "route-map",
		className: "h-full w-full",
		style: {
			touchAction: "none",
			overflow: "hidden"
		}
	});
}
//#endregion
export { RouteMap as default };
