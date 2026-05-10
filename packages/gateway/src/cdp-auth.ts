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
   * CDP hands keys out in several formats depending on the key type / age:
   *   - Legacy PEM:        full '-----BEGIN ...-----' block (EC or Ed25519 PKCS8)
   *   - PKCS8 DER (b64):   ~64 chars, the raw ASN.1 PKCS8 wrapper, base64-encoded
   *   - Ed25519 seed+pub:  88 chars b64 → 64 bytes = 32-byte seed || 32-byte public
   *                        (CDP Server Wallet API; what we hit today)
   *   - Ed25519 seed only: 44 chars b64 → 32-byte seed
   * Normalise all four to a PKCS8 PEM string the rest of the pipeline can consume.
   */
  function toPkcs8Pem(raw: string): string {
    const stripped = raw.trim();
    if (stripped.startsWith("-----BEGIN")) return stripped;

    const b64 = stripped.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) {
      throw new Error(
        "CDP_API_KEY_SECRET is neither a PEM block nor a base64-encoded key. " +
          "Paste the value the CDP dashboard shows you verbatim.",
      );
    }
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Buffer.from(padded, "base64");

    let pkcs8Der: Buffer;
    if (bytes.length === 32) {
      pkcs8Der = wrapEd25519Seed(bytes);
    } else if (bytes.length === 64) {
      // Ed25519 seed (first 32 bytes) || public key (last 32 bytes)
      pkcs8Der = wrapEd25519Seed(bytes.subarray(0, 32));
    } else if (bytes.length >= 16 && bytes[0] === 0x30) {
      // Looks like an ASN.1 DER SEQUENCE — assume it's already valid PKCS8.
      pkcs8Der = bytes;
    } else {
      throw new Error(
        `CDP_API_KEY_SECRET decoded to ${bytes.length} bytes which is not a recognised ` +
          `key shape. Expected 32 (Ed25519 seed), 64 (Ed25519 seed+public), or a PKCS8 DER blob.`,
      );
    }

    const wrapped = pkcs8Der.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }

  /**
   * Wrap a raw 32-byte Ed25519 seed in the canonical PKCS8 envelope.
   * The 16-byte prefix is fixed for Ed25519 (RFC 8410):
   *   SEQ(0x30) len(0x2e) INT 0x00 SEQ(0x05) OID(2b6570 = 1.3.101.112) OCTET-STR 32+2
   */
  function wrapEd25519Seed(seed: Buffer): Buffer {
    if (seed.length !== 32) {
      throw new Error("Ed25519 seed must be exactly 32 bytes");
    }
    const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
    return Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
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
