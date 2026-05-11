# SwarmApi

[![Smithery](https://smithery.ai/badge/swarm-api/swarmapi)](https://smithery.ai/servers/swarm-api/swarmapi)

Pay-per-call APIs for AI agents: SEC filings, company news, insider trades, jobs, web search, GitHub health, and package CVEs. Each request is settled in **USDC on Base** via the **[x402](https://www.x402.org/)** protocol — no API keys or subscriptions.

| Resource | URL |
| --- | --- |
| **Website** | [swarm-api.com](https://swarm-api.com) |
| **Production gateway** | `https://api.swarm-api.com` |
| **Smithery registry** | [swarm-api/swarmapi](https://smithery.ai/servers/swarm-api/swarmapi) |
| **Dashboard** | [dashboard.swarm-api.com](https://dashboard.swarm-api.com) |
| **Marketplace** | [marketplace.swarm-api.com](https://marketplace.swarm-api.com) |

## Install

```bash
npx -y @swarm-api/setup
```

Walks through a Base wallet, USDC funding, and an MCP config block for Claude Desktop, Cursor, and other MCP hosts.

**Packages**

- [`@swarm-api/mcp`](https://www.npmjs.com/package/@swarm-api/mcp) — Model Context Protocol server (nine tools).
- [`@swarm-api/setup`](https://www.npmjs.com/package/@swarm-api/setup) — Wallet + funding + client config.
- [`@swarm-api/sdk`](https://www.npmjs.com/package/@swarm-api/sdk) — TypeScript client for custom HTTP integrations.

## Repository layout

This monorepo contains the gateway, MCP server, SDK, setup CLI, marketplace UI, and landing site. See each package’s `README.md` for development notes.

## License

MIT
