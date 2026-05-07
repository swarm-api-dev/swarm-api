import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

export class BudgetExceededError extends Error {
  readonly code = "BUDGET_EXCEEDED";
  readonly requested: bigint;
  readonly allowed: bigint;
  constructor(requested: bigint, allowed: bigint) {
    super(`Budget exceeded: ${requested} requested > ${allowed} allowed (atomic units)`);
    this.name = "BudgetExceededError";
    this.requested = requested;
    this.allowed = allowed;
  }
}

export interface AgentClientConfig {
  privateKey: `0x${string}`;
  maxSpendPerRequest: bigint;
}

export function createAgentClient(config: AgentClientConfig): typeof fetch {
  const account = privateKeyToAccount(config.privateKey);

  const core = new x402Client();
  registerExactEvmScheme(core, { signer: account });
  core.registerPolicy((_v, reqs) => {
    const within = reqs.filter((r) => BigInt(r.amount) <= config.maxSpendPerRequest);
    if (within.length === 0 && reqs.length > 0) {
      const cheapest = reqs
        .map((r) => BigInt(r.amount))
        .reduce((a, b) => (a < b ? a : b));
      throw new BudgetExceededError(cheapest, config.maxSpendPerRequest);
    }
    return within;
  });

  const httpClient = new x402HTTPClient(core);
  const inner = wrapFetchWithPayment(fetch, httpClient);

  const wrapped: typeof inner = async (input, init) => {
    try {
      return await inner(input, init);
    } catch (err) {
      if (err instanceof Error && /Budget exceeded:/.test(err.message)) {
        const m = err.message.match(/(\d+) requested > (\d+) allowed/);
        if (m) throw new BudgetExceededError(BigInt(m[1]!), BigInt(m[2]!));
      }
      throw err;
    }
  };

  return wrapped as typeof fetch;
}
