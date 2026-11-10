import type { LatLng } from "@/lib/db/schema";

/** Transport zones: 3 km linear-distance bands to the closest CBC. The last zone is open-ended (15 km and above). */
export const ZONE_BAND_KM = 3;
export const ZONE_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export function zoneForDistance(km: number): string {
  const idx = Math.min(Math.floor(km / ZONE_BAND_KM), ZONE_LETTERS.length - 1);
  return ZONE_LETTERS[Math.max(0, idx)];
}

export function zoneRangeLabel(letter: string): string {
  const i = ZONE_LETTERS.indexOf(letter as (typeof ZONE_LETTERS)[number]);
  if (i < 0) return "";
  if (i === ZONE_LETTERS.length - 1) return `${i * ZONE_BAND_KM} km and above`;
  return `${i * ZONE_BAND_KM}–${(i + 1) * ZONE_BAND_KM} km`;
}

const R = 6_371_008.8; // mean Earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return (2 * R * Math.asin(Math.min(1, Math.sqrt(s)))) / 1000;
}

/** Geodesic polygon area in square metres (Chamberlain & Duquette, as used by Turf). Ring may be open. */
export function polygonAreaM2(ring: LatLng[]): number {
  const pts = ring.length > 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  const n = pts.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    total += (toRad(p3[1]) - toRad(p1[1])) * Math.sin(toRad(p2[0]));
  }
  return Math.abs((total * R * R) / 2);
}

export function polygonCentroid(ring: LatLng[]): LatLng {
  const n = ring.length;
  if (n === 0) return [0, 0];
  if (n < 3) return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  // Planar centroid in degrees; fine for field-sized polygons.
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const [y0, x0] = ring[i];
    const [y1, x1] = ring[(i + 1) % n];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-12) return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  return [cy / (6 * a), cx / (6 * a)];
}

export const M2_PER_ACRE = 4046.8564224;
export const M2_PER_HECTARE = 10_000;

export type ZoningResult = {
  centroid: LatLng;
  areaM2: number;
  acres: number;
  hectares: number;
  nearestCbcId: string | null;
  nearestCbcName: string | null;
  distanceKm: number | null;
  zone: string | null;
};

export function computeZoning(ring: LatLng[], cbcs: { id: string; name: string; lat: number; lng: number }[]): ZoningResult {
  const centroid = polygonCentroid(ring);
  const areaM2 = polygonAreaM2(ring);
  let best: { id: string; name: string; km: number } | null = null;
  for (const c of cbcs) {
    const km = haversineKm(centroid, [c.lat, c.lng]);
    if (!best || km < best.km) best = { id: c.id, name: c.name, km };
  }
  return {
    centroid,
    areaM2,
    acres: areaM2 / M2_PER_ACRE,
    hectares: areaM2 / M2_PER_HECTARE,
    nearestCbcId: best?.id ?? null,
    nearestCbcName: best?.name ?? null,
    distanceKm: best ? Math.round(best.km * 100) / 100 : null,
    zone: best ? zoneForDistance(best.km) : null,
  };
}
