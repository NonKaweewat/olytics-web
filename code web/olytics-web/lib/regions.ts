// The five official regions of Brazil (IBGE). The KPI views only carry states,
// so regions are derived in the web app from this table.

export const REGIONS = {
  north: { label: "North (Norte)", states: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"] },
  northeast: { label: "Northeast (Nordeste)", states: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"] },
  "central-west": { label: "Central-West (Centro-Oeste)", states: ["DF", "GO", "MT", "MS"] },
  southeast: { label: "Southeast (Sudeste)", states: ["ES", "MG", "RJ", "SP"] },
  south: { label: "South (Sul)", states: ["PR", "RS", "SC"] },
} as const;

export type RegionId = keyof typeof REGIONS;

export function isRegion(v: unknown): v is RegionId {
  return typeof v === "string" && Object.hasOwn(REGIONS, v);
}

export function regionOf(state: string): RegionId | null {
  for (const [id, r] of Object.entries(REGIONS)) {
    if ((r.states as readonly string[]).includes(state)) return id as RegionId;
  }
  return null;
}

/** Short label for charts, e.g. "Southeast". */
export function regionShort(id: RegionId): string {
  return REGIONS[id].label.split(" (")[0];
}
