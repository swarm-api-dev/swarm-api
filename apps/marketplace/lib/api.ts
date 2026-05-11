const DEFAULT_GATEWAY = "https://api.swarm-api.com";

function resolveGatewayBase(): string {
  const raw = process.env.GATEWAY_URL?.trim();
  if (!raw) return DEFAULT_GATEWAY;
  try {
    const u = new URL(raw);
    const marketing = new Set(["swarm-api.com", "www.swarm-api.com", "marketplace.swarm-api.com"]);
    if (marketing.has(u.hostname)) return DEFAULT_GATEWAY;
    return raw.replace(/\/+$/, "");
  } catch {
    return DEFAULT_GATEWAY;
  }
}

const GATEWAY_URL = resolveGatewayBase();

export interface Endpoint {
  id: string;
  name: string;
  description: string | null;
  method: string;
  resource: string;
  priceAtomic: string;
  asset: string;
  network: string;
  payTo: string;
  gatewayUrl: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchEndpoints(): Promise<Endpoint[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/catalog`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return [];
    const data = (await res.json()) as { endpoints?: Endpoint[] };
    const endpoints = data.endpoints ?? [];
    return endpoints.slice().sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
