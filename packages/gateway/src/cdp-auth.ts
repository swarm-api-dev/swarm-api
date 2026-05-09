import { randomBytes } from "node:crypto";
import { SignJWT, importPKCS8, type KeyLike } from "jose";

export interface CdpAuthHeaders {
  verify: Record<string, string>;
  settle: Record<string, string>;
  supported: Record<string, string>;
}

export interface CdpKey {
  /** API key name. From CDP, looks like `organizations/<org-id>/apiKeys/<key-id>` or a UUID. */
  name: string;
  /** Private key. PEM-encoded. ES256 (EC P-256) or EdDSA (Ed25519). */
  secret: string;
}

type Alg = "ES256" | "EdDSA";

/**
 * Build a `createAuthHeaders` callback compatible with @x402/core's
 * `HTTPFacilitatorClient` config. Each invocation mints three fresh JWTs —
 * one per facilitator path (verify, settle, supported) — bound to the
 * exact `<METHOD> <host><path>` URI Coinbase requires for replay protection.
 *
 * JWT lifetime is 120s; the SDK calls this callback per facilitator
 * round-trip so expiry is rarely an issue in practice.
 */
export function createCdpAuthHeaders(
  facilitatorUrl: string,
  key: CdpKey,
): () => Promise<CdpAuthHeaders> {
  const url = new URL(facilitatorUrl);
  const host = url.host;
  const basePath = url.pathname.replace(/\/$/, "");

  let cachedKey: KeyLike | null = null;
  let cachedAlg: Alg = "ES256";

  async function ensureKey(): Promise<void> {
    if (cachedKey) return;
    const pem = key.secret.trim();
    if (!pem.startsWith("-----BEGIN")) {
      throw new Error(
        "CDP_API_KEY_SECRET must be PEM-encoded (starts with '-----BEGIN ...'). " +
          "Copy the full block including BEGIN/END lines from the CDP dashboard.",
      );
    }
    cachedAlg =
      pem.includes("BEGIN ED25519") || pem.includes("ED25519 PRIVATE KEY") || pem.includes("Ed25519")
        ? "EdDSA"
        : "ES256";
    cachedKey = await importPKCS8(pem, cachedAlg);
  }

  async function mintJwt(method: "GET" | "POST", path: string): Promise<string> {
    await ensureKey();
    const now = Math.floor(Date.now() / 1000);
    const uri = `${method} ${host}${basePath}${path}`;
    return await new SignJWT({
      iss: "cdp",
      sub: key.name,
      aud: ["cdp_service"],
      nbf: now,
      exp: now + 120,
      uri,
    })
      .setProtectedHeader({
        alg: cachedAlg,
        typ: "JWT",
        kid: key.name,
        nonce: randomBytes(16).toString("hex"),
      })
      .sign(cachedKey!);
  }

  return async () => {
    const [verify, settle, supported] = await Promise.all([
      mintJwt("POST", "/verify"),
      mintJwt("POST", "/settle"),
      mintJwt("GET", "/supported"),
    ]);
    return {
      verify: { Authorization: `Bearer ${verify}` },
      settle: { Authorization: `Bearer ${settle}` },
      supported: { Authorization: `Bearer ${supported}` },
    };
  };
}
