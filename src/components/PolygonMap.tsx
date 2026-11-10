"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Polygon as LPolygon, CircleMarker, LayerGroup, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/db/schema";
import { Button } from "./ui";
import { cx } from "@/lib/format";

type CbcPoint = { id: string; name: string; lat: number; lng: number };

const DEFAULT_CENTER: LatLng = [-1.05, 34.68]; // Transmara / Migori cane belt

export function PolygonMap({
  value,
  onChange,
  readOnly = false,
  cbcs = [],
  highlightCbcId,
  centroid,
  className,
}: {
  value: LatLng[];
  onChange?: (ring: LatLng[]) => void;
  readOnly?: boolean;
  cbcs?: CbcPoint[];
  highlightCbcId?: string | null;
  centroid?: LatLng | null;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const polyRef = useRef<LPolygon | null>(null);
  const vertsRef = useRef<LayerGroup | null>(null);
  const cbcLayerRef = useRef<LayerGroup | null>(null);
  const tilesRef = useRef<{ sat: TileLayer; street: TileLayer } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [basemap, setBasemap] = useState<"sat" | "street">("sat");
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { zoomControl: true, attributionControl: true, tap: true } as never);
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
      );
      const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      });
      sat.addTo(map);
      tilesRef.current = { sat, street };
      vertsRef.current = L.layerGroup().addTo(map);
      cbcLayerRef.current = L.layerGroup().addTo(map);
      polyRef.current = L.polygon([], { color: "#D08A1E", weight: 3, fillColor: "#F0CF8A", fillOpacity: 0.25 }).addTo(map);

      if (!readOnly) {
        map.on("click", (e) => {
          const next: LatLng[] = [...valueRef.current, [round(e.latlng.lat), round(e.latlng.lng)]];
          onChangeRef.current?.(next);
        });
      }
      mapRef.current = map;
      // Initial view
      if (valueRef.current.length >= 2) {
        map.fitBounds(L.latLngBounds(valueRef.current.map(([a, b]) => L.latLng(a, b))), { padding: [24, 24] });
      } else {
        map.setView(DEFAULT_CENTER, 11);
      }
      draw();
      drawCbcs();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function draw() {
    const L = (await import("leaflet")).default;
    const map = mapRef.current;
    if (!map || !polyRef.current || !vertsRef.current) return;
    const ring = valueRef.current;
    polyRef.current.setLatLngs(ring.map(([a, b]) => L.latLng(a, b)));
    vertsRef.current.clearLayers();
    ring.forEach(([lat, lng], idx) => {
      const m: CircleMarker = L.circleMarker([lat, lng], {
        radius: readOnly ? 4 : 9,
        color: "#15211A",
        weight: 2,
        fillColor: idx === 0 ? "#D08A1E" : "#FFFFFF",
        fillOpacity: 1,
      });
      if (!readOnly) {
        // Drag-to-move a corner (circle markers are not draggable in Leaflet, so emulate it).
        let dragging = false;
        m.on("mousedown touchstart", () => {
          dragging = true;
          map.dragging.disable();
        });
        const move = (e: { latlng: { lat: number; lng: number } }) => {
          if (!dragging) return;
          m.setLatLng(e.latlng);
          const next = valueRef.current.slice();
          next[idx] = [round(e.latlng.lat), round(e.latlng.lng)];
          polyRef.current?.setLatLngs(next.map(([a, b]) => L.latLng(a, b)));
          valueRef.current = next;
        };
        const up = () => {
          if (!dragging) return;
          dragging = false;
          map.dragging.enable();
          onChangeRef.current?.(valueRef.current);
        };
        map.on("mousemove", move as never);
        map.on("mouseup", up);
        m.on("click", (e) => {
          // Click on a corner removes it (long tap on mobile would be nicer, but this is predictable).
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent && (e.originalEvent as MouseEvent).shiftKey) {
            const next = valueRef.current.filter((_, i) => i !== idx);
            onChangeRef.current?.(next);
          }
        });
        m.bindTooltip(`Corner ${idx + 1}`, { direction: "top", offset: [0, -8] });
      }
      vertsRef.current!.addLayer(m);
    });
    if (centroid) {
      const c = L.circleMarker(centroid, { radius: 3, color: "#B3261E", fillColor: "#B3261E", fillOpacity: 1 });
      c.bindTooltip("Centroid", { direction: "right" });
      vertsRef.current.addLayer(c);
    }
  }

  async function drawCbcs() {
    const L = (await import("leaflet")).default;
    const layer = cbcLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const c of cbcs) {
      const hl = c.id === highlightCbcId;
      const icon = L.divIcon({
        className: "",
        html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none">
          <span style="background:${hl ? "#1F4D2B" : "rgba(21,33,26,.85)"};color:#fff;font:600 11px/1.2 system-ui;padding:3px 6px;border-radius:4px;white-space:nowrap">${c.name}</span>
          <span style="width:10px;height:10px;border-radius:50%;background:${hl ? "#8DB890" : "#fff"};border:2px solid #1F4D2B"></span></div>`,
        iconSize: [0, 0],
      });
      L.marker([c.lat, c.lng], { icon, interactive: false }).addTo(layer);
    }
    if (centroid && highlightCbcId) {
      const target = cbcs.find((c) => c.id === highlightCbcId);
      if (target) L.polyline([centroid, [target.lat, target.lng]], { color: "#1F4D2B", dashArray: "6 6", weight: 2 }).addTo(layer);
    }
  }

  useEffect(() => {
    void draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, centroid]);

  useEffect(() => {
    void drawCbcs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cbcs, highlightCbcId, centroid]);

  useEffect(() => {
    const t = tilesRef.current;
    const map = mapRef.current;
    if (!t || !map) return;
    if (basemap === "sat") { map.removeLayer(t.street); t.sat.addTo(map); }
    else { map.removeLayer(t.sat); t.street.addTo(map); }
  }, [basemap]);

  function addGpsCorner() {
    if (!navigator.geolocation) return setMsg("This device does not report its location.");
    setLocating(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p: LatLng = [round(pos.coords.latitude), round(pos.coords.longitude)];
        onChangeRef.current?.([...valueRef.current, p]);
        mapRef.current?.setView(p, Math.max(mapRef.current.getZoom(), 17));
        setMsg(`Corner added at ±${Math.round(pos.coords.accuracy)} m accuracy.`);
      },
      (err) => {
        setLocating(false);
        setMsg(err.code === 1 ? "Location permission was denied. Allow location for this site and try again." : "Could not get a GPS fix. Move to open sky and try again.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function importFile(file: File) {
    const text = await file.text();
    let ring: LatLng[] = [];
    try {
      if (/\.(geo)?json$/i.test(file.name) || text.trim().startsWith("{")) {
        const gj = JSON.parse(text);
        const geom = gj.type === "FeatureCollection" ? gj.features?.[0]?.geometry : gj.type === "Feature" ? gj.geometry : gj;
        const coords: number[][] = geom?.type === "Polygon" ? geom.coordinates[0] : geom?.type === "MultiPolygon" ? geom.coordinates[0][0] : [];
        ring = coords.map(([lng, lat]) => [round(lat), round(lng)]);
      } else {
        // KML: first <coordinates> block, "lng,lat[,alt]" tuples.
        const m = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
        ring = (m?.[1] ?? "")
          .trim()
          .split(/\s+/)
          .map((t) => t.split(",").map(Number))
          .filter((a) => a.length >= 2 && a.every((n) => Number.isFinite(n)))
          .map(([lng, lat]) => [round(lat), round(lng)]);
      }
    } catch {
      ring = [];
    }
    if (ring.length >= 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);
    if (ring.length < 3) return setMsg("Could not read a polygon from that file. Use a KML or GeoJSON with one polygon.");
    onChangeRef.current?.(ring);
    const L = (await import("leaflet")).default;
    mapRef.current?.fitBounds(L.latLngBounds(ring.map(([a, b]) => L.latLng(a, b))), { padding: [24, 24] });
    setMsg(`Imported ${ring.length} corners.`);
  }

  function fitToField() {
    void (async () => {
      const L = (await import("leaflet")).default;
      if (valueRef.current.length >= 2) mapRef.current?.fitBounds(L.latLngBounds(valueRef.current.map(([a, b]) => L.latLng(a, b))), { padding: [24, 24] });
    })();
  }

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div className="relative">
        <div ref={el} className={cx("w-full rounded-lg overflow-hidden border border-stone-200 bg-stone-100", readOnly ? "h-[280px] sm:h-[340px]" : "h-[360px] sm:h-[440px]")} aria-label="Field map" />
        <div className="absolute top-2 right-2 z-[500] flex gap-1 rounded-md bg-white/95 p-1 text-[13px] shadow-card">
          <button type="button" onClick={() => setBasemap("sat")} className={cx("rounded px-2 py-1", basemap === "sat" ? "bg-cane-700 text-white" : "hover:bg-stone-100")}>Satellite</button>
          <button type="button" onClick={() => setBasemap("street")} className={cx("rounded px-2 py-1", basemap === "street" ? "bg-cane-700 text-white" : "hover:bg-stone-100")}>Streets</button>
        </div>
      </div>
      {!readOnly && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={addGpsCorner} disabled={locating}>
              {locating ? "Getting GPS fix…" : "Add corner at my position"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onChange?.(value.slice(0, -1))} disabled={!value.length}>Undo last corner</Button>
            <Button type="button" variant="secondary" size="sm" onClick={fitToField} disabled={value.length < 2}>Fit to field</Button>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-medium hover:bg-stone-100">
              Import KML / GeoJSON
              <input type="file" accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/geo+json,application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            </label>
            <Button type="button" variant="danger" size="sm" onClick={() => onChange?.([])} disabled={!value.length}>Clear</Button>
          </div>
          <p className="text-sm text-stone-500">
            Tap the map at each corner of the field, walking round in order. Drag a corner to adjust it; shift-click a corner to remove it.
            {msg && <span className="block text-ink mt-1">{msg}</span>}
          </p>
        </>
      )}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 1e7) / 1e7;
}
