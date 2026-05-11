# Smithery domain verification

Smithery checks **DNS TXT** on the **apex host** of your homepage and scans the **homepage / README** for a backlink.

## 1. TXT record (apex `swarm-api.com`)

**Added on Vercel DNS** for the apex (`@`): record id `rec_bbfdfccd403acc9e625e8092`, value `smithery-verification=606bb92272e01bd82c07ff31023b13c3b8f3ea50c78702b3c221a7844299337f`. Re-run the check on Smithery after TTL/propagation (often within minutes).

To reproduce or fix on **Vercel-managed DNS**:

```bash
npx vercel dns add swarm-api.com @ TXT "smithery-verification=606bb92272e01bd82c07ff31023b13c3b8f3ea50c78702b3c221a7844299337f"
```

(Use the exact string Smithery gives you if they rotate verification.)

If DNS ever moves off Vercel, add the same TXT at your provider:

| Field | Value |
| --- | --- |
| **Name / Host** | `@` or `swarm-api.com` (provider-specific; often `@` for apex) |
| **Type** | `TXT` |
| **Content / Value** | `smithery-verification=606bb92272e01bd82c07ff31023b13c3b8f3ea50c78702b3c221a7844299337f` |

Keep existing TXT records (SPF, etc.). This is an **additional** TXT value.

## 2. Homepage & README backlink

The canonical listing URL is:

`https://smithery.ai/servers/swarm-api/swarmapi`

This repo includes:

- A visible link (and full URL text) in the **landing hero** foot line on [swarm-api.com](https://swarm-api.com).
- Footer link **Smithery** → same URL.
- Root **README** badge + table row pointing at Smithery.

If verification still fails, allow **`SmitheryBot/1.0 (+https://smithery.ai)`** through any WAF or bot protection on the marketing site.

## 3. Optional: custom backlink URL

In Smithery settings you can set a **custom backlink URL** to a path on `swarm-api.com` that contains the link (e.g. `/` or a dedicated integrations page).
