import type { CdpKey } from "./cdp-auth";
import { mintCdpPlatformJwt } from "./cdp-auth";

const CREATE_SESSION_PATH = "/platform/v2/onramp/sessions";
const CDP_REST_ORIGIN = "https://api.cdp.coinbase.com";

export interface CoinbaseOnrampSessionResponse {
  session: { onrampUrl: string };
  quote?: Record<string, unknown>;
}

/**
 * Calls Coinbase CDP [Create an onramp session](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session).
 * Returns a single-use `onrampUrl` (includes `sessionToken`).
 */
export async function createCoinbaseOnrampSession(
  key: CdpKey,
  payload: Record<string, unknown>,
): Promise<CoinbaseOnrampSessionResponse> {
  const jwt = await mintCdpPlatformJwt(key, "POST", CREATE_SESSION_PATH);
  const res = await fetch(`${CDP_REST_ORIGIN}${CREATE_SESSION_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Coinbase Onramp API returned non-JSON (${res.status}): ${text.slice(0, 500)}`);
  }

  if (!res.ok) {
    const err = body as { errorMessage?: string; errorType?: string };
    const msg = err?.errorMessage ?? text.slice(0, 500);
    throw new Error(`Coinbase Onramp API ${res.status}: ${msg}`);
  }

  const parsed = body as CoinbaseOnrampSessionResponse;
  const url = parsed?.session?.onrampUrl;
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("Coinbase Onramp API returned no session.onrampUrl");
  }
  return parsed;
}
