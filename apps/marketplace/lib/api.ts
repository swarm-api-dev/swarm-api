const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:3000";

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
  const res = await fetch(`${GATEWAY_URL}/v1/catalog`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gateway /v1/catalog failed: ${res.status}`);
  const data = (await res.json()) as { endpoints: Endpoint[] };
  return data.endpoints.sort((a, b) => a.name.localeCompare(b.name));
}
