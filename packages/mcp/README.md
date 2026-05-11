# @swarm-api/mcp

[![npm version](https://img.shields.io/npm/v/@swarm-api/mcp.svg)](https://www.npmjs.com/package/@swarm-api/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**MCP server for SwarmApi — 9 pay-per-call tools for AI agents.** SEC filings, company news, insider transactions, jobs, web search, GitHub repo health, and npm/PyPI/cargo package security. Every call is settled per request in USDC on Base mainnet via the [x402](https://www.x402.org/) protocol — no API keys, no monthly subscription, no rate limits keyed to your account.

Works with **Claude Desktop**, **Cursor**, **Continue**, **Cline**, or any MCP-compatible client.

---

## What you get

| Tool | What it does | Cost (USDC) |
| --- | --- | ---: |
| `resolve_company` | Resolve a ticker / CIK / free-form name to canonical SEC records. | $0.002 |
| `list_filings` | List recent 10-K, 10-Q, 8-K, S-1, Form 4 (etc.) filings for a CIK. | $0.005 |
| `extract_filing` | Parse a 10-K/10-Q/8-K into structured per-Item JSON (Item 1A, 7, 5.02, …). | $0.05 |
| `company_news` | Recent news mentions via GDELT 2.0 (refreshed every 15 minutes). | $0.02 |
| `company_jobs` | Open Greenhouse / Lever job postings — proxy for hiring trends. | $0.01 |
| `insider_transactions` | Form 4 transactions (CEO/CFO open-market buys, awards, exercises). | $0.03 |
| `web_search` | General web search via Brave Search. | $0.01 |
| `github_repo` | Repo snapshot: stars, languages, commits, releases, contributors. | $0.005 |
| `package_info` | npm/PyPI/cargo: latest version, deps, CVEs (OSV.dev), deprecation. | $0.005 |

Browse the full catalog: <https://marketplace.swarm-api.com>

---

## Quick start

You need:
- An MCP-compatible client (Claude Desktop, Cursor, Continue, etc.).
- A Base mainnet **EOA private key** (0x-prefixed, 32 bytes) funded with **USDC on Base**. Bridge or buy via Coinbase, Onramp, or any DEX. $5 of USDC pays for ~1,000 typical tool calls.

### Claude Desktop

Add this block to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "swarmapi": {
      "command": "npx",
      "args": ["-y", "@swarm-api/mcp"],
      "env": {
        "SWARMAPI_PRIVATE_KEY": "0xYOUR_BASE_PRIVATE_KEY_WITH_USDC"
      }
    }
  }
}
```

Restart Claude Desktop. You should see all 9 tools available in the new chat picker.

### Cursor

In `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "swarmapi": {
      "command": "npx",
      "args": ["-y", "@swarm-api/mcp"],
      "env": {
        "SWARMAPI_PRIVATE_KEY": "0xYOUR_BASE_PRIVATE_KEY_WITH_USDC"
      }
    }
  }
}
```

### Test the server directly

```bash
SWARMAPI_PRIVATE_KEY=0x... npx @swarm-api/mcp
```

It speaks the standard MCP `stdio` transport, so any client that can spawn an stdio MCP server will work.

---

## Configuration

| Env var | Required | Default | Purpose |
| --- | :---: | --- | --- |
| `SWARMAPI_PRIVATE_KEY` | yes | — | Base mainnet EOA private key (0x-prefixed) with USDC balance. Also accepts `AGENT_PRIVATE_KEY`. |
| `SWARMAPI_GATEWAY_URL` | no | `https://api.swarm-api.com` | Override if you're self-hosting the gateway. |
| `SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC` | no | `100000` (= $0.10) | Per-call hard ceiling in atomic USDC units (6 decimals). Refuses any 402 challenge above this. |

The hard spend cap protects you from buggy clients or runaway tool calls — the SDK throws `BudgetExceededError` before signing if the server asks for more than `SWARMAPI_MAX_SPEND_PER_REQUEST_ATOMIC`.

---

## How payment works

Every tool call hits the gateway over HTTP. The gateway returns `402 Payment Required` with a payment challenge (resource, price, recipient wallet, asset = USDC on Base 8453). The SDK signs an [EIP-3009 `transferWithAuthorization`](https://eips.ethereum.org/EIPS/eip-3009) message off-chain, the gateway submits it to the [Coinbase CDP facilitator](https://docs.cdp.coinbase.com/x402/welcome), USDC moves on-chain, and the gateway returns the actual tool result. Total latency per tool call is typically 800-1500ms.

You can audit every payment your key has made at <https://dashboard.swarm-api.com>.

---

## Funding the wallet

The signing wallet is just a Base mainnet EOA. Fund it however you like:

1. Send USDC on Base from an existing wallet (Coinbase Wallet, Rabby, MetaMask + Base network).
2. Buy directly via [Coinbase Onramp](https://www.coinbase.com/onramp).
3. Bridge from Ethereum via the [official Base bridge](https://bridge.base.com).

USDC contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

You can generate a fresh Base EOA with our setup tool:

```bash
npx @swarm-api/setup
```

This walks you through key generation, funding via Coinbase Onramp, and dropping the Claude Desktop config block.

---

## Source code

- MCP server: <https://github.com/swarm-api-dev/swarm-api/tree/main/packages/mcp>
- Payment SDK: <https://github.com/swarm-api-dev/swarm-api/tree/main/packages/sdk>
- Gateway: <https://github.com/swarm-api-dev/swarm-api/tree/main/packages/gateway>

## License

MIT
