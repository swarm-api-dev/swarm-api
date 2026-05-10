import { createPrivateKey, randomBytes } from "node:crypto";
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
    const pem = toPkcs8Pem(key.secret);
    // PKCS8 PEM headers say '-----BEGIN PRIVATE KEY-----' regardless of curve,
    // so we route through Node's KeyObject which reads the DER OID and reports
    // the actual algorithm. Then jose imports with the right alg.
    const keyType = createPrivateKey(pem).asymmetricKeyType;
    if (keyType === "ed25519") {
      cachedAlg = "EdDSA";
    } else if (keyType === "ec") {
      cachedAlg = "ES256";
    } else {
      throw new Error(
        `Unsupported CDP key algorithm "${keyType ?? "unknown"}". Expected ed25519 or ec (P-256).`,
      );
    }
    cachedKey = await importPKCS8(pem, cachedAlg);
  }

  /**
   * CDP hands keys out in two formats:
   *   - Legacy: full PEM block ('-----BEGIN ... -----').
   *   - Newer:  single-line base64-encoded PKCS8 DER (no PEM wrapper).
   * Normalise both to a PEM string before parsing.
   */
  function toPkcs8Pem(raw: string): string {
    const stripped = raw.trim();
    if (stripped.startsWith("-----BEGIN")) return stripped;

    // Treat as base64 PKCS8 DER. Accept stdandard and URL-safe alphabets;
    // ignore whitespace; tolerate missing padding.
    const b64 = stripped.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) {
      throw new Error(
        "CDP_API_KEY_SECRET is neither a PEM block nor base64-encoded PKCS8 DER. " +
          "Paste the value the CDP dashboard shows you verbatim.",
      );
    }
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const wrapped = padded.match(/.{1,64}/g)?.join("\n") ?? padded;
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
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
