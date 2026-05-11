# @swarm-api/sdk

Fetch-style HTTP client for agents: handles **HTTP 402** payment challenges from [x402](https://github.com/x402-foundation/x402) gateways, signs EIP-3009 USDC authorizations on Base, and enforces a per-request spend ceiling.

```ts
import { createAgentClient } from "@swarm-api/sdk";

const fetchWithPayment = createAgentClient({
  privateKey: "0x…",
  maxSpendPerRequest: 100_000n, // $0.10 atomic USDC (6 decimals)
});

const res = await fetchWithPayment("https://api.swarm-api.com/v1/…");
```

Repo: [swarm-api-dev/swarm-api](https://github.com/swarm-api-dev/swarm-api) · `packages/sdk`
